// ~/src/rewoo/rewoo.ts

import { v4 as uuid } from 'uuid';

import { PlannerAgent } from './planner';
import { SolverAgent } from './solver';
import { Worker } from './worker';

import type { AiConfig } from './ai';
import type { State, Tool, ReWOOCallbacks } from './types';

export class ReWOO {
  private planner: PlannerAgent;
  private worker: Worker;
  private solver: SolverAgent;
  private callbacks?: ReWOOCallbacks;
  private state: State = { session_id: uuid(), task: '' };

  constructor(ai_config: AiConfig, tools: Tool[], callbacks?: ReWOOCallbacks) {
    this.planner = new PlannerAgent(ai_config, tools);
    this.worker = new Worker(tools, ai_config);
    this.solver = new SolverAgent(ai_config);
    this.callbacks = callbacks;
  }

  // Add getters
  get session_id(): string {
    return this.state.session_id;
  }

  get current_state(): State {
    return { ...this.state };
  }

  async process(task: string): Promise<State> {
    this.state = {
      session_id: this.state.session_id,
      task,
      timestamp: Date.now(),
      errors: [],
    };

    console.log(`\n📋 Processing task: "${task}"`);

    try {
      // Plan step
      console.log('🧩 Creating execution plan...');
      const plan_result = await this.planner.create_plan(task);
      this.state = { ...this.state, ...plan_result };
      this.callbacks?.onPlan?.(this.state);

      // Execute tools if we have steps
      if (this.state.steps && this.state.steps.length > 0) {
        this.state.results = {};
        console.log(`\n🔧 Executing ${this.state.steps.length} steps...`);

        for (let i = 0; i < this.state.steps.length; i++) {
          const step = this.state.steps[i];
          console.log(
            `\n📝 Step ${i + 1}/${this.state.steps.length}: ${step.tool} - ${
              step.plan
            }`
          );

          try {
            const result = await this.worker.execute_step(
              step,
              this.state.results
            );
            this.state.results[step.variable] = result;
            this.callbacks?.onToolExecute?.(step, result);
          } catch (error) {
            console.error(`❌ Error executing step ${step.variable}: ${error}`);
            // Continue with next step even if one fails
            this.state.results[step.variable] = `Error: ${
              error instanceof Error ? error.message : String(error)
            }`;
          }
        }
      }

      // Solve the task
      console.log('\n🧠 Solving task based on collected information...');
      const solution = await this.solver.solve(this.state);
      this.state.result = solution;
      this.callbacks?.onSolve?.(this.state);

      return this.state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`\n❌ Process error: ${err.message}`);
      this.callbacks?.onError?.(err, this.state);

      // Attempt to get a fallback solution even if errors occurred
      if (!this.state.result) {
        console.log('\n🔄 Attempting fallback solution...');
        try {
          const fallback = await this.solver.solve(this.state);
          this.state.result = fallback;
        } catch (solveError) {
          console.error(`\n❌ Fallback failed: ${solveError}`);
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
