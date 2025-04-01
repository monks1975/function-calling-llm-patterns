// ~/src/rewoo/solver.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from '../core';

import type { EventBus } from './events';
import type { ReWooState } from './types';

// Template for the system prompt
// prettier-ignore
const solver_system_prompt = Handlebars.compile(
`Today's date: {{today}}

You are an expert at solving tasks using provided evidence.

Your role is to analyze the evidence and provide a clear, accurate solution.

Solutions must follow this format exactly:

<evidence>
**#E1:** <summary of evidence for step #E1>
**#E2:** <summary of evidence for step #E2>
...
</evidence>

<solution>
A clear and concise solution to the task.
</solution>

Example 1 (Photosynthesis):
<evidence>
**#E1:** Overview of photosynthesis process including light absorption, water splitting, and glucose production
**#E2:** Details about chloroplasts, thylakoids, and other cellular structures involved
</evidence>

<solution>
Photosynthesis is the process by which plants convert light energy into chemical energy. The process occurs in chloroplasts and involves capturing sunlight, splitting water molecules, and producing glucose and oxygen.
</solution>

Example 2 (Quantum Computing):
<evidence>
**#E1:** Previous research on quantum computing fundamentals
**#E2:** Recent quantum computing breakthroughs and advances
**#E3:** Current practical applications in cryptography and optimization
</evidence>

<solution>
Quantum computing leverages quantum mechanical properties to perform certain computations exponentially faster than classical computers. Recent advances have improved qubit stability and error correction, with practical applications emerging in cryptography and optimization problems.
</solution>

Example 3 (Climate Change):
<evidence>
**#E1:** Historical climate data showing temperature trends
**#E2:** Recent studies on current climate impacts
**#E3:** Analysis of mitigation strategies and their effectiveness
</evidence>

<solution>
Climate change is causing measurable global temperature increases with widespread environmental impacts. Evidence shows accelerating effects, but various mitigation strategies like renewable energy adoption and carbon capture show promise in reducing future impacts.
</solution>`
);

// Template for the user prompt
// prettier-ignore
const solver_user_template = Handlebars.compile(
`Solve the following task. To help you solve the task, we have made step-by-step Plans and retrieved corresponding Evidence for each Plan. Use them with caution since long evidence might contain irrelevant information. You will need to sift through the evidence to find the most relevant information to solve the problem.

{{plan_with_evidence}}

Now solve the task or problem according to the provided Evidence above. If evidence is missing or incomplete, use your best judgment but be transparent about any assumptions. If it's impossible to solve the task from the evidence provided, then say so.

Task: {{task}}

Start by briefly summarizing the key information from each piece of evidence. Then provide your final answer.`
);

export class SolverAgent {
  private ai: AiGenerate;
  private event_bus: EventBus;

  constructor(ai_config: AiConfig, event_bus: EventBus) {
    this.ai = new AiGenerate(ai_config, event_bus, 'solver');
    this.event_bus = event_bus;
  }

  private create_system_prompt(): string {
    return solver_system_prompt({
      today: new Date().toLocaleDateString('en-GB'),
    });
  }

  private create_user_prompt(plan_with_evidence: string, task: string): string {
    return solver_user_template({
      plan_with_evidence,
      task,
    });
  }

  async solve(state: ReWooState): Promise<string> {
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

      const system_prompt = this.create_system_prompt();
      const user_prompt = this.create_user_prompt(
        plan_with_evidence,
        state.task
      );

      const result = await this.ai.get_completion([
        { role: 'system', content: system_prompt },
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
