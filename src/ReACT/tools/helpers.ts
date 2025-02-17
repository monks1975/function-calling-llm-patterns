// ~/src/REACT-COT/tools/helpers.ts

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface ToolResponse {
  results?: string;
  error?: string;
}

export const log_tool = {
  tool: (name: string, input: any, output: ToolResponse) => {
    console.log(`\n🔧 ${name} Tool`);
  },
};

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

export function zod_schema_to_description(schema: z.ZodType): string {
  const json_schema = zodToJsonSchema(schema, { $refStrategy: 'none' });
  return JSON.stringify(json_schema, null, 2).replace(/"([^"]+)":/g, '$1:');
}
