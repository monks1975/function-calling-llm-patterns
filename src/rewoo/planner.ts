// ~/src/ReWOO/planner.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from './ai';

import type { EventBus } from './events';
import type { State, Tool } from './types';

// Handlebars template for the planner prompt
// prettier-ignore
const planner_template = Handlebars.compile(
`You are an expert planner that breaks tasks into sequential steps.

Today's date: {{today}}

Available tools:
{{#each tools}}
({{name}})[input]: {{description}}
{{/each}}

Create ONE sequential plan to solve the given task. Each step must follow this format exactly:
Plan: <description> #E<number> = <tool>[<args>]

Rules:
1. Create exactly ONE plan - do not revise or provide alternatives
2. Each step must have exactly one #E variable
3. Number steps sequentially starting at #E1
4. Each step must use an available tool
5. Later steps can reference earlier #E variables in their args

Examples:

Task: What are the latest developments in quantum computing?
Plan: Search for current quantum computing news. #E1 = Search[latest quantum computing breakthroughs 2024]
Plan: Analyze and summarize findings. #E2 = LLM[Summarize key developments from (#E1)]

Task: Explain how blockchain works
Plan: Search for technical details. #E1 = Search[blockchain technology explanation]
Plan: Create clear explanation. #E2 = LLM[Create beginner-friendly explanation from (#E1)]

Task: What is the capital of France?
Plan: Search for basic facts. #E1 = Search[capital of France facts]
Plan: Format response clearly. #E2 = LLM[Create concise response about Paris from (#E1)]

Task: What happened in the latest SpaceX launch?
Plan: Search recent news. #E1 = Search[latest SpaceX launch news]
Plan: Summarize key points. #E2 = LLM[Create summary of launch from (#E1)]

Task: Define the word "serendipity"
Plan: Search for definition. #E1 = Search[serendipity definition and examples]
Plan: Create clear explanation. #E2 = LLM[Format definition and examples from (#E1)]

Task: What did we discuss about climate change last week?
Plan: Search recent memory for climate discussions. #E1 = RecentMemory[climate change]
Plan: Analyze and summarize the conversation. #E2 = LLM[Create summary from (#E1)]

Task: What have I asked about artificial intelligence?
Plan: Search memory for AI-related queries. #E1 = MemoryByKeyword[artificial intelligence, AI, machine learning]
Plan: Create comprehensive overview. #E2 = LLM[Synthesize AI discussions from (#E1)]

Task: Find our previous discussions about renewable energy
Plan: Search memory for energy topics. #E1 = MemoryByKeyword[renewable energy, solar, wind power]
Plan: Organize key points. #E2 = LLM[Create structured summary from (#E1)]

Task: What background do we have on space exploration?
Plan: Retrieve space-related memories. #E1 = MemoryByKeyword[space exploration, NASA, astronomy]
Plan: Create contextual summary. #E2 = LLM[Build comprehensive context from (#E1)]

Task: What have we covered about quantum physics?
Plan: Get quantum physics discussions. #E1 = MemoryByKeyword[quantum physics, quantum mechanics]
Plan: Synthesize learning progress. #E2 = LLM[Create learning timeline from (#E1)]

Begin!
Describe your plans with rich details. Each Plan should be followed by only one #E.
Task: {{task}}`
);

export class PlannerAgent {
  private ai: AiGenerate;
  private tools: Tool[];
  private event_bus: EventBus;
  private readonly regex_pattern =
    /Plan:\s*(.+)\s*(#E\d+)\s*=\s*(\w+)\s*\[([^\]]+)\]/g;

  constructor(ai_config: AiConfig, tools: Tool[], event_bus: EventBus) {
    this.ai = new AiGenerate(ai_config, event_bus, 'planner');
    this.tools = tools;
    this.event_bus = event_bus;
  }

  async create_plan(task: string): Promise<Partial<State>> {
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
      let plan_result: Partial<State>;

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

  private create_system_prompt(): string {
    return `You are an expert planner that breaks tasks into sequential steps.`;
  }

  private create_user_prompt(task: string): string {
    return planner_template({
      tools: this.tools,
      today: new Date().toLocaleDateString('en-GB'),
      task,
    });
  }
}
