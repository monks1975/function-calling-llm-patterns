// ~/src/ReACT/tools/helpers.ts

import { z } from 'zod';

export interface ToolResponse {
  result?: string;
  error?: string;
}

export const handle_tool_error = (
  tool_name: string,
  message?: string,
  error?: unknown
): ToolResponse => {
  let error_log = '';
  if (error instanceof Error) {
    error_log = error.message;
  } else if (error instanceof z.ZodError) {
    error_log = error.errors.map((e) => e.message).join(', ');
  }

  const error_message =
    message || `An error occurred using the tool: ${tool_name}.`;
  return { error: `${error_message} ${error_log}`.trim() };
};

export function zod_schema_to_text(schema: z.ZodType): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const entries = Object.entries(shape);

    let description = '';

    entries.forEach(([key, value]) => {
      description += `${key}:\n`;

      // Handle string type
      if (value instanceof z.ZodString) {
        description += '  Type: string\n';

        // Get min length if it exists
        const checks = value._def.checks || [];
        const minCheck = checks.find((check: any) => check.kind === 'min');
        if (minCheck && 'value' in minCheck) {
          description += `  Minimum Length: ${minCheck.value}\n`;
        }

        // Get description if it exists
        if ('description' in value && value.description) {
          description += `  Description: ${value.description}\n`;
        }
      }

      // Handle number type
      if (value instanceof z.ZodNumber) {
        description += '  Type: number\n';
      }

      // Handle boolean type
      if (value instanceof z.ZodBoolean) {
        description += '  Type: boolean\n';
      }
    });

    return description;
  }

  return 'Unsupported schema type';
}
