// ~/src/PlanExecute/helpers.ts

import { join } from 'path';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import Handlebars from 'handlebars';

import { Plan, Solution, plan_schema, solution_schema } from './types';

import type { ToolRegistry } from './types';

/**
 * Load and parse YAML file
 */
const load_yaml = (file_path: string) => {
  try {
    const file_content = readFileSync(file_path, 'utf8');
    return load(file_content) as { examples: Array<[Record<string, any>]> };
  } catch (error) {
    throw new Error(`Failed to load YAML file ${file_path}: ${error}`);
  }
};

/**
 * Format plan examples as JSON strings matching plan_schema
 */
export const get_plan_examples = () => {
  const examples = load_yaml(join(__dirname, 'plan.examples.yaml'));
  return examples.examples
    .map(([example]) => {
      const plan: Plan = {
        query: example.query,
        actions: example.actions.map((action: any, index: number) => ({
          id: action.id || index + 1,
          tool: action.tool,
          input: action.input,
          reasoning: action.reasoning,
          evidence_var: action.evidence_var || `#E${index + 1}`,
        })),
      };
      return JSON.stringify(plan, null, 2);
    })
    .join('\n\n');
};

/**
 * Format solution examples as JSON strings matching solution_schema
 */
export const get_solve_examples = () => {
  const examples = load_yaml(join(__dirname, 'solve.examples.yaml'));
  return examples.examples
    .map(([example]) => {
      const solution: Solution = {
        query: example.query,
        answer: example.answer,
        reasoning: example.reasoning,
      };
      return JSON.stringify(solution, null, 2);
    })
    .join('\n\n');
};

// Handlebars templates for prompts
const planner_template = Handlebars.compile(
  `You are a helpful planner agent that creates step-by-step plans to solve user queries.
For each step, specify:
1. Your reasoning for the step
2. The tool to use from the available tools
3. The input for the tool
4. A variable name to store the evidence in (#E1, #E2, etc.)

Available tools:

{{#each tools}}
({{@index}}) {{this}}
{{/each}}

The plan should be detailed and account for all necessary steps to solve the query.
If you think it makes sense, provide a little redundancy in your plan, by having multiple paths to the same end goal.

Your output must be valid JSON conforming to this schema:

{{{schema}}}

Here are some example plans formatted as valid JSON:

{{{examples}}}`
);

const solver_template = Handlebars.compile(
  `You are a precise reasoning agent that produces clear, accurate solutions based on plans and evidence.
You will receive:
1. The original query
2. A plan with reasoning steps
3. Evidence collected from executing the plan

Your task is to synthesize all information and provide the best possible answer to the query.
Focus on accuracy and clarity, citing specific evidence where relevant.

Your output must be valid JSON conforming to this schema:

{{{schema}}}

Here are some example solutions formatted as valid JSON:

{{{examples}}}`
);

/**
 * Get enhanced system prompts with examples
 */
export const get_enhanced_prompts = (tool_registry: ToolRegistry) => {
  const plan_examples = get_plan_examples();
  const solve_examples = get_solve_examples();

  const tools = Object.values(tool_registry.get_all()).map(
    (tool) => tool.description
  );

  return {
    planner_prompt: planner_template({
      tools,
      schema: JSON.stringify(plan_schema.shape, null, 2),
      examples: plan_examples,
    }),

    solver_prompt: solver_template({
      schema: JSON.stringify(solution_schema.shape, null, 2),
      examples: solve_examples,
    }),
  };
};

/**
 * Sanitizes HTML content by removing HTML tags and decoding HTML entities
 * Also cleans up Wikipedia-specific markup
 */
export function sanitize_html(html: string): string {
  return (
    html
      // Remove HTML tags
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Decode HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      // Clean up Wikipedia specific markup
      .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2') // [[link|text]] -> text
      .replace(/\[\[([^\]]*)\]\]/g, '$1') // [[text]] -> text
      .replace(/''+/g, '') // Remove bold/italic markers
      .replace(/\{\{([^}]*)\}\}/g, '') // Remove templates
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}
