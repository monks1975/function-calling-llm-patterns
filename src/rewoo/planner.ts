// ~/src/ReWOO/planner.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from '../core';
import { examples } from './planner.examples';

import type { EventBus } from './events';
import type { ReWooPlanExample, ReWooState, ReWooTool } from './types';

const planner_system_prompt = `You are an expert planner that breaks tasks into sequential steps.`;

// prettier-ignore
const planner_user_template = Handlebars.compile(
`Today's date: {{today}}

Create a sequential plan of 1-5 steps to solve the given task. Each step must follow this format exactly:
Plan: <description> #E<number> = <tool>[<args>]

Rules:

1. Create exactly ONE plan - do not revise or provide alternatives
2. Each step must have exactly one #E variable
3. Number steps sequentially starting at #E1
4. Each step must use an available tool
5. Later steps can reference earlier #E variables in their args
6. Plans should be a maximum of 5 steps

{{{tools}}}

Describe your plans with rich details. Each Plan must be followed by only one #E.

Begin!

Task: {{{task}}}`
);

// prettier-ignore
const tools_template = Handlebars.compile(
`Available tools:

{{#each tools}}
{{name}}: {{description}}
{{/each}}

{{#if examples.length}}
Examples:

{{#each examples}}
Task: {{this.task}}
{{#each this.plan_steps}}
Plan: {{{this}}}
{{/each}}

{{/each}}
{{/if}}`
);

export class PlannerAgent {
  private ai: AiGenerate;
  private tools: ReWooTool[];
  private event_bus: EventBus;

  private readonly regex_pattern =
    /Plan:\s*(.+)\s*(#E\d+)\s*=\s*(\w+)\s*\[([^\]]+)\]/g;

  constructor(ai_config: AiConfig, tools: ReWooTool[], event_bus: EventBus) {
    this.ai = new AiGenerate(ai_config, event_bus, 'planner');
    this.event_bus = event_bus;
    this.tools = tools;
  }

  // Function to filter planner examples based on available tools
  private get_compatible_examples(
    tool_names: string[],
    examples: ReWooPlanExample[]
  ): ReWooPlanExample[] {
    return examples.filter((example) =>
      example.required_tools.every((tool) => tool_names.includes(tool))
    );
  }

  // Function to build planner examples prompt with filtered examples
  private build_planner_examples(
    available_tools: ReWooTool[],
    examples: ReWooPlanExample[]
  ): string {
    const compatible_examples = this.get_compatible_examples(
      available_tools.map((tool) => tool.name),
      examples
    );

    return tools_template({
      tools: available_tools,
      examples: compatible_examples,
    });
  }

  private create_system_prompt(): string {
    return planner_system_prompt;
  }

  private create_user_prompt(task: string): string {
    return planner_user_template({
      tools: this.build_planner_examples(this.tools, examples),
      today: new Date().toLocaleDateString('en-GB'),
      task,
    });
  }

  async create_plan(task: string): Promise<Partial<ReWooState>> {
    try {
      // Emit planning start event
      this.event_bus.emit({
        type: 'tool_start',
        step: {
          plan: 'Creating execution plan',
          variable: 'plan',
          tool: 'planner',
          args: task,
        },
        args: task,
      });

      const system_message = this.create_system_prompt();
      const user_message = this.create_user_prompt(task);

      // Get the plan from the AI
      const result = await this.ai.get_completion([
        { role: 'system', content: system_message },
        { role: 'user', content: user_message },
      ]);

      // Parse the plan using regex
      const matches = Array.from(result.matchAll(this.regex_pattern));
      let plan_result: Partial<ReWooState>;

      if (matches.length === 0) {
        // Fallback to ensure at least one step
        plan_result = {
          plan_string: result,
          steps: [
            {
              plan: 'Get information about the topic',
              variable: '#E1',
              tool: 'LLM',
              args: task,
            },
          ],
        };

        // Emit fallback plan event
        this.event_bus.emit({
          type: 'tool_complete',
          step: {
            plan: 'Creating execution plan',
            variable: 'plan',
            tool: 'planner',
            args: task,
          },
          result: 'Created fallback plan',
        });
      } else {
        const steps = matches.map((match) => ({
          plan: match[1].trim(),
          variable: match[2].trim(),
          tool: match[3].trim(),
          args: match[4].trim(),
        }));

        plan_result = {
          plan_string: result,
          steps,
        };

        // Emit plan created event
        this.event_bus.emit({
          type: 'tool_complete',
          step: {
            plan: 'Creating execution plan',
            variable: 'plan',
            tool: 'planner',
            args: task,
          },
          result: `Created plan with ${steps.length} steps`,
        });
      }

      // Emit plan_created event with the plan data
      this.event_bus.emit({
        type: 'plan_created',
        plan: plan_result,
      });

      return plan_result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.event_bus.emit({
        type: 'error',
        error: err,
        context: 'plan_creation',
      });

      // Return a minimal fallback plan
      const fallback_plan = {
        plan_string: 'Error creating plan, using fallback',
        steps: [
          {
            plan: 'Get information about the topic',
            variable: '#E1',
            tool: 'LLM',
            args: task,
          },
        ],
      };

      // Also emit the fallback plan
      this.event_bus.emit({
        type: 'plan_created',
        plan: fallback_plan,
      });

      return fallback_plan;
    }
  }
}
