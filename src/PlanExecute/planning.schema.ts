// ~/src/PlanExecute/planning.schema.ts

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Define available tools
export const available_tools = [
  'web_crawler',
  'calculator',
  'library_lookup',
  'news_search',
] as const;

// Define a schema for the planning structure
export const plan_schema = z.object({
  title: z.string().describe('A concise title for the plan'),
  steps: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).describe('Step number'),
      description: z.string().describe('What to do in this step'),
      tool: z
        .enum(available_tools)
        .optional()
        .describe('Tool to use for this step'),
    })
  ),
  goal: z.string().describe('The original goal to accomplish'),
});

// Type for the plan based on the schema
export type Plan = z.infer<typeof plan_schema>;

// Interface for the YAML examples structure
export interface ExampleData {
  examples: Array<{
    request: string;
    plan: Plan;
  }>;
}

// Convert Zod schema to JSON Schema for OpenAI
export const plan_json_schema = zodToJsonSchema(plan_schema, {
  target: 'openAi',
});
