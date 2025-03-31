// ~/src/ReACT/tools/thought.tool.ts

import { z } from 'zod';
import * as dotenv from 'dotenv';
import Handlebars from 'handlebars';

import { AiGenerate } from '../../core/ai/ai';
import { handle_tool_error, zod_schema_to_text } from './helpers';

import type { ToolResponse } from './helpers';

// Prompt templates
const SYSTEM_PROMPT =
  'You are a thoughtful AI assistant that provides clear, concise reasoning. Keep responses under 100 words.';

// prettier-ignore
const THOUGHT_PROMPT = 
`Take a breath and think through the following context and task carefully:

User Question: {{user_question}}
Context: {{context}}
Task: {{task}}

Provide a clear, concise thought process that:
1. Identifies the core problem
2. Considers key factors
3. Suggests a path forward

Keep your response under 100 words.`;

// Compile templates
const thought_template = Handlebars.compile(THOUGHT_PROMPT);

dotenv.config();

export const schema = z.object({
  user_question: z.string().min(1, 'User question is required'),
  context: z.string().min(1, 'Context is required'),
  task: z.string().min(1, 'Task is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type ThoughtToolParams = z.infer<typeof schema>;

/**
 * Thought Tool
 *
 * A tool for generating thinking steps using the AI model.
 * Takes user question, context and task as input and returns a structured thought process.
 *
 * @param user_question - The original question or query from the user
 * @param context - The current context or situation
 * @param task - The specific task or problem to think about
 *
 * @returns Object containing the generated thought process or error
 *
 * Example:
 * Input: {
 *   user_question: "How do I fix the login issues?",
 *   context: "Debugging a web app",
 *   task: "Fix login issues"
 * }
 * Output: { result: "1. First, I need to understand the login flow..." }
 */
export const thought_tool = async ({
  user_question = '',
  context = '',
  task = '',
}: ThoughtToolParams): Promise<ToolResponse> => {
  try {
    // Validate input
    const validated_input = schema.parse({ user_question, context, task });

    const groq_api_key = process.env.GROQ_API_KEY;

    if (!groq_api_key) {
      return handle_tool_error(
        'thought',
        'Groq API key not found in environment variables'
      );
    }

    const ai = new AiGenerate({
      base_url: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 750,
      api_key: groq_api_key,
    });

    const thought_process = await ai.get_completion([
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: thought_template(validated_input),
      },
    ]);

    return { result: thought_process };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'thought',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('thought', undefined, error);
  }
};
