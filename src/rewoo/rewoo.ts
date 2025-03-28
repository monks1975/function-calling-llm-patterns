// ~/src/ReWOO/rewoo.ts
//
// ReWOO (Reasoning WithOut Observation) - A reactive AI workflow engine
//
// Core Components:
// - PlannerAgent: Breaks down tasks into executable steps
// - Worker: Executes individual steps using provided tools
// - SolverAgent: Synthesizes results into final solutions
// - EventBus: Manages reactive event flow between components
//
// Main Dependencies:
// - RxJS: For reactive event handling and state management
// - OpenAI: For AI-powered planning and execution
//
// Architecture:
// - Built on RxJS Observables for reactive event handling
// - Two-layer event system:
//   1. Low-level tool events (tool_start, tool_complete, error)
//   2. High-level process events (plan, solve)
// - Event filtering and subscription via RxJS operators
// - Shared event stream for multiple subscribers

import { Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { event_bus } from './events';
import { PlannerAgent } from './planner';
import { SolverAgent } from './solver';
import { Worker } from './worker';

import type { AiConfig } from './ai';
import type { ReWooEvidenceRecord, ReWooState } from './types';
import type { ReWooTool } from './types';

/**
 * ReWOO
 *
 * Manages the execution of AI-powered workflows through a three-stage process:
 * 1. Planning: Breaks down tasks into executable steps
 * 2. Execution: Runs each step using provided tools
 * 3. Solving: Synthesizes results into final solutions
 *
 * Features:
 * - Reactive event handling via RxJS
 * - Token usage tracking
 * - Error handling and recovery
 * - Session-based state management
 * - Evidence record generation
 */
export class ReWOO {
  private planner: PlannerAgent;
  private worker: Worker;
  private solver: SolverAgent;
  private subscriptions = new Subscription();
  private state: ReWooState = { session_id: uuid(), task: '' };
  private tools: ReWooTool[] = [];

  /**
   * Creates a new ReWOO instance
   * @param ai_config - Configuration for AI models and parameters
   * @param tools - Array of tools available for task execution
   */
  constructor(ai_config: AiConfig, tools: ReWooTool[]) {
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

  /**
   * Gets the current session ID
   */
  get session_id(): string {
    return this.state.session_id;
  }

  /**
   * Gets a copy of the current state
   */
  get current_state(): ReWooState {
    return { ...this.state };
  }

  /**
   * Gets evidence records for the current session
   * Maps internal state to evidence table schema
   */
  get evidence_records(): ReWooEvidenceRecord[] {
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

  /**
   * Processes a task through the ReWOO workflow
   *
   * Flow:
   * 1. Creates execution plan
   * 2. Executes each step
   * 3. Synthesizes final solution
   *
   * @param task - The task to process
   * @returns Promise<State> - Final state with results
   */
  async process(task: string): Promise<ReWooState> {
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

  /**
   * Cleans up resources and subscriptions
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from all events
    this.subscriptions.unsubscribe();

    // Clear tools array
    this.tools = [];
  }
}
