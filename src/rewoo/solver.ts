// ~/src/ReWOO/solver.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from './ai';

import type { State, ToolCallbacks } from './types';

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
  private callbacks?: ToolCallbacks;

  constructor(ai_config: AiConfig, callbacks?: ToolCallbacks) {
    this.ai = new AiGenerate(ai_config);
    this.callbacks = callbacks;
  }

  async solve(state: State): Promise<string> {
    try {
      this.callbacks?.onExecuteStart?.('Solving task with collected evidence');

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

      const result = await this.ai.get_completion(
        [
          { role: 'system', content: solver_template },
          { role: 'user', content: user_prompt },
        ],
        undefined,
        {
          onCompletion: (completion) => {
            this.callbacks?.onCompletion?.(completion, 'solver');
          },
        }
      );

      this.callbacks?.onExecuteComplete?.('Generated solution');
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks?.onExecuteError?.(err);
      throw err;
    }
  }
}
