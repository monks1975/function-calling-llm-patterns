// ~/src/ReWOO/rewoo.ts
//
// Event System Architecture:
// - Built on Node's EventEmitter for pub/sub event handling
// - Two-layer event system:
//   1. Low-level tool events (tool_start, tool_complete, error)
//   2. High-level process events (plan, solve)
// - Callbacks can be registered for granular control

import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { event_bus } from './events';
import { PlannerAgent } from './planner';
import { SolverAgent } from './solver';
import { Worker } from './worker';

import type { AiConfig } from './ai';
import type { EvidenceRecord, State } from './types';
import type { Tool } from './types';

export class ReWOO {
  private planner: PlannerAgent;
  private worker: Worker;
  private solver: SolverAgent;
  private subscriptions = new Subscription();
  private state: State = { session_id: uuid(), task: '' };
  private tools: Tool[] = [];

  constructor(ai_config: AiConfig, tools: Tool[]) {
    this.planner = new PlannerAgent(ai_config, tools, event_bus);
    this.worker = new Worker(ai_config, tools, event_bus);
    this.solver = new SolverAgent(ai_config, event_bus);
    this.tools = tools;

    // Subscribe to completion events to track token usage
    this.subscriptions.add(
      event_bus.onCompletion().subscribe((event) => {
        // Track token usage
        if (event.completion.usage) {
          if (!this.state.token_usage) this.state.token_usage = [];
          this.state.token_usage.push({
            source: event.source,
            prompt_tokens: event.completion.usage.prompt_tokens,
            completion_tokens: event.completion.usage.completion_tokens,
            total_tokens: event.completion.usage.total_tokens,
          });
        }
      })
    );
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
          }
        }
      }

      const solution = await this.solver.solve(this.state);
      this.state.result = solution;

      return this.state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

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

  async cleanup(): Promise<void> {
    // Unsubscribe from all events
    this.subscriptions.unsubscribe();

    // Clear tools array
    this.tools = [];
  }
}
