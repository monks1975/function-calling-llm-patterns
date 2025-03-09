// ~/src/ReWOO/rewoo.ts
//
// Event System Architecture:
// - Built on Node's EventEmitter for pub/sub event handling
// - Two-layer event system:
//   1. Low-level tool events (tool_start, tool_complete, error)
//   2. High-level process events (plan, solve)
// - Callbacks can be registered for granular control
// - Each tool gets its own event emitter instance

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

import { PlannerAgent } from './planner';
import { SolverAgent } from './solver';
import { Worker } from './worker';

import type { AiConfig } from './ai';
import type { EvidenceRecord, State } from './types';
import type { ExecutionEvent, ExecutionContext } from './types';
import type { ReWOOCallbacks, ReWOOEventEmitter, ReWOOEventMap } from './types';
import type { Tool, ToolCallbacks } from './types';

export class ReWOO extends EventEmitter implements ReWOOEventEmitter {
  private planner: PlannerAgent;
  private worker: Worker;
  private solver: SolverAgent;
  private callbacks?: ReWOOCallbacks;
  private state: State = { session_id: uuid(), task: '' };
  private tools: Tool[] = [];

  constructor(ai_config: AiConfig, tools: Tool[], callbacks?: ReWOOCallbacks) {
    super();
    this.callbacks = callbacks;
    this.tools = tools;

    // Increase event listener limit to handle tool-specific events
    this.setMaxListeners(tools.length + 10);

    // Tool callback adapter maps low-level tool events to the event system
    // Each tool operation (start, complete, error) emits a corresponding event
    const tool_callbacks: ToolCallbacks = {
      onExecuteStart: (args) => {
        this.emit_execution_event({
          type: 'tool_start',
          context: this.create_execution_context({ args }),
        });
      },
      onExecuteComplete: (result, step) => {
        this.emit_execution_event({
          type: 'tool_complete',
          context: this.create_execution_context({ step }),
          data: result,
        });
      },
      onExecuteError: (error) => {
        this.emit_execution_event({
          type: 'error',
          context: this.create_execution_context(),
          error,
        });
      },
      onCompletion: (completion, source = 'tool', tool_name?: string) => {
        const tokens = completion.usage
          ? {
              prompt: completion.usage.prompt_tokens,
              completion: completion.usage.completion_tokens,
              total: completion.usage.total_tokens,
            }
          : undefined;

        if (tokens) {
          if (!this.state.token_usage) {
            this.state.token_usage = [];
          }
          this.state.token_usage.push({
            source,
            tool_name,
            prompt_tokens: tokens.prompt,
            completion_tokens: tokens.completion,
            total_tokens: tokens.total,
          });
        }

        this.emit_execution_event({
          type: 'completion',
          context: this.create_execution_context(),
          data: {
            completion,
            source,
            tool_name,
            tokens,
          },
        });
      },
    };

    // Each tool gets access to the event emitter for publishing tool-specific events
    tools.forEach((tool) => {
      tool.emitter = this;
    });

    this.planner = new PlannerAgent(ai_config, tools, tool_callbacks);
    this.worker = new Worker(tools, ai_config, tool_callbacks);
    this.solver = new SolverAgent(ai_config, tool_callbacks);
  }

  // Override emit to ensure all events also trigger the generic onEvent callback
  emit<K extends keyof ReWOOEventMap>(
    event: K,
    args: ReWOOEventMap[K]
  ): boolean {
    this.callbacks?.onEvent?.(args);
    return super.emit(event, args);
  }

  // Central event dispatcher that maps execution events to specific callbacks
  // Handles both tool events and process lifecycle events
  private emit_execution_event(event: ExecutionEvent): void {
    // Emit the event
    this.emit('rewoo:event', event);

    // Map events to callbacks
    switch (event.type) {
      case 'plan':
        this.callbacks?.onPlan?.(event.context.state!);
        break;
      case 'tool_complete':
        if (event.context.step) {
          this.callbacks?.onToolExecute?.(
            event.context.step,
            event.data as string
          );
        }
        break;
      case 'solve':
        this.callbacks?.onSolve?.(event.context.state!);
        break;
      case 'error':
        if (event.error) {
          this.callbacks?.onError?.(event.error, event.context.state!);
        }
        break;
    }
  }

  // Creates consistent execution context for all events
  // Ensures events have access to current state and session info
  private create_execution_context(
    partial?: Partial<ExecutionContext>
  ): ExecutionContext {
    return {
      session_id: this.state.session_id,
      task: this.state.task,
      state: this.state,
      ...partial,
    };
  }

  // Comprehensive cleanup of event listeners and references
  // Prevents memory leaks and ensures proper teardown
  async cleanup(): Promise<void> {
    // Remove all event listeners
    this.removeAllListeners();

    // Remove emitter references from tools
    this.tools.forEach((tool) => {
      tool.emitter = undefined;
    });

    // Clear tools array
    this.tools = [];

    // Cleanup components that might have their own cleanup needs
    if ('cleanup' in this.worker && typeof this.worker.cleanup === 'function') {
      await this.worker.cleanup();
    }
    if (
      'cleanup' in this.planner &&
      typeof this.planner.cleanup === 'function'
    ) {
      await this.planner.cleanup();
    }
    if ('cleanup' in this.solver && typeof this.solver.cleanup === 'function') {
      await this.solver.cleanup();
    }

    // Clear callbacks
    this.callbacks = undefined;
  }

  // Add getters
  get session_id(): string {
    return this.state.session_id;
  }

  get current_state(): State {
    return { ...this.state };
  }

  // Getter for evidence records in a session; row-based
  // Maps to evidence table schema
  get evidence_records(): EvidenceRecord[] {
    return Object.entries(this.state.results || {}).map(
      ([variable, content], idx) => ({
        session_id: this.state.session_id,
        evidence_id: `E${idx + 1}`,
        content,
        created_at: this.state.timestamp || Date.now(),
        step_variable: variable,
      })
    );
  }

  async process(task: string): Promise<State> {
    this.state = {
      session_id: this.state.session_id,
      task,
      timestamp: Date.now(),
      errors: [],
    };

    try {
      const plan_result = await this.planner.create_plan(task);
      this.state = { ...this.state, ...plan_result };

      this.emit_execution_event({
        type: 'plan',
        context: this.create_execution_context(),
        data: plan_result,
      });

      if (this.state.steps && this.state.steps.length > 0) {
        this.state.results = {};

        for (const step of this.state.steps) {
          try {
            const result = await this.worker.execute_step(
              step,
              this.state.results
            );
            this.state.results[step.variable] = result;
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            this.state.results[step.variable] = `Error: ${err.message}`;

            this.emit_execution_event({
              type: 'error',
              context: this.create_execution_context({ step }),
              error: err,
            });
          }
        }
      }

      const solution = await this.solver.solve(this.state);
      this.state.result = solution;

      this.emit_execution_event({
        type: 'solve',
        context: this.create_execution_context(),
        data: solution,
      });

      return this.state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.emit_execution_event({
        type: 'error',
        context: this.create_execution_context(),
        error: err,
      });

      if (!this.state.result) {
        try {
          const fallback = await this.solver.solve(this.state);
          this.state.result = fallback;
        } catch (solveError) {
          this.state.result = 'Unable to complete the task due to errors.';
        }
      }

      return this.state;
    }
  }

  get_execution_summary(): string {
    if (!this.state.steps || !this.state.results) {
      return 'No execution data available.';
    }

    let summary = `EXECUTION SUMMARY\n${'='.repeat(30)}\n`;
    summary += `Task: ${this.state.task}\n\n`;

    this.state.steps.forEach((step, index) => {
      const result = this.state.results?.[step.variable];
      const status = result
        ? result.startsWith('Error:')
          ? '❌'
          : '✅'
        : '⚠️';

      summary += `Step ${index + 1}: ${status} ${step.variable}\n`;
      summary += `  Plan: ${step.plan}\n`;
      summary += `  Tool: ${step.tool}\n`;
      summary += `  Args: ${step.args}\n`;
      if (result) {
        const truncated =
          result.length > 100 ? result.substring(0, 100) + '...' : result;
        summary += `  Result: ${truncated}\n`;
      } else {
        summary += `  Result: Not executed\n`;
      }
      summary += '\n';
    });

    return summary;
  }
}
