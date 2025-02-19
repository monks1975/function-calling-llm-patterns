// ~/src/ReACT/react.schema.ts

import { z } from 'zod';

export const react_response_schema = z
  .object({
    thought: z.string().min(1, {
      message:
        'You must include a "thought" field explaining your reasoning. This field cannot be empty.',
    }),
    action: z.string().optional(),
    input: z.union([z.record(z.any()), z.string()]).optional(),
    final_answer: z.string().optional(),
  })
  .refine(
    (data) => {
      const is_final_answer = data.final_answer && !data.action && !data.input;
      const is_tool_action = !data.final_answer && data.action && data.input;
      const is_thinking = !data.final_answer && !data.action && !data.input;
      return is_final_answer || is_tool_action || is_thinking;
    },
    {
      message:
        'Your response must follow one of these formats:\n' +
        '1. Include a "thought" and "final_answer" when you have the solution\n' +
        '2. Include a "thought", "action", and "input" when you need to use a tool\n' +
        '3. Include only a "thought" when you are thinking but not ready to act\n' +
        'Example valid responses:\n' +
        '{ "thought": "This is a well-known fact", "final_answer": "William Shakespeare wrote Romeo and Juliet" }\n' +
        '{ "thought": "I should search the knowledge base", "action": "Library", "input": {"query": "deployment steps"} }\n' +
        '{ "thought": "I need to think about this more" }',
    }
  );
