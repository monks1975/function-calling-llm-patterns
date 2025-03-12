// ~/src/ReWOO/solver.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from './ai';

import type { EventBus } from './events';
import type { State } from './types';

// Template for the system prompt
const solver_template = `You are an expert at solving tasks using provided evidence.
Your role is to analyze the evidence and provide a clear, accurate solution.
If evidence is missing or incomplete, use your best judgment but be transparent about any assumptions.`;

// Template for the user prompt
// prettier-ignore
const user_template = Handlebars.compile(
`Solve the following task. To help you solve the task, we have made step-by-step Plans and retrieved corresponding Evidence for each Plan. Use them with caution since long evidence might contain irrelevant information. You will need to sift through the evidence to find the most relevant information to solve the problem.

{{plan_with_evidence}}

Now solve the task or problem according to the provided Evidence above. If evidence is missing or incomplete, use your best judgment.
Task: {{task}}

First, briefly summarize the key information from each piece of evidence. Then provide your final answer.`
);

export class SolverAgent {
  private ai: AiGenerate;
  private event_bus: EventBus;

  constructor(ai_config: AiConfig, event_bus: EventBus) {
    this.ai = new AiGenerate(ai_config, event_bus, 'solver');
    this.event_bus = event_bus;
  }

  async solve(state: State): Promise<string> {
    try {
      // Emit solver start event
      this.event_bus.emit({
        type: 'tool_start',
        step: {
          plan: 'Solving task with collected evidence',
          variable: 'solution',
          tool: 'solver',
          args: state.task,
        },
        args: state.task,
      });

      // Format the plan and evidence for better visibility
      let plan_with_evidence = '';

      if (state.steps && state.results) {
        for (const step of state.steps) {
          const result = state.results[step.variable] || '(No result)';
          const result_summary =
            result.length > 300
              ? result.substring(0, 300) + '... (truncated)'
              : result;

          plan_with_evidence += `Step: ${step.plan}\n`;
          plan_with_evidence += `Tool: ${step.tool}[${step.args}]\n`;
          plan_with_evidence += `**Evidence ${step.variable}:**\n${result_summary}\n\n`;
        }
      } else if (state.plan_string) {
        plan_with_evidence = state.plan_string;
      }

      const user_prompt = user_template({
        plan_with_evidence,
        task: state.task,
      });

      const result = await this.ai.get_completion([
        { role: 'system', content: solver_template },
        { role: 'user', content: user_prompt },
      ]);

      // Emit solver complete event
      this.event_bus.emit({
        type: 'tool_complete',
        step: {
          plan: 'Solving task with collected evidence',
          variable: 'solution',
          tool: 'solver',
          args: state.task,
        },
        result: 'Generated solution',
      });

      // Emit solution found event
      this.event_bus.emit({
        type: 'solution_found',
        solution: result,
        state: {
          ...state,
          result,
        },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.event_bus.emit({
        type: 'error',
        error: err,
        context: 'solution_generation',
      });

      throw err;
    }
  }
}
