// ~/src/ReACT/tools/calculator.tool.ts

import { z } from 'zod';
import * as math from 'mathjs';

import { handle_tool_error, zod_schema_to_text } from './helpers';

import type { ToolResponse } from './helpers';

export const schema = z.object({
  expression: z.string().min(1, 'Expression is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type CalculatorToolParams = z.infer<typeof schema>;

/**
 * Calculator Tool
 *
 * A tool for evaluating mathematical expressions using the math.js library.
 * Validates input using Zod schema and returns the calculated result as a string.
 *
 * @param expression - The mathematical expression to evaluate
 *
 * @returns Object containing calculated result as string or error
 *
 * Example:
 * Input: { expression: "2 + 2" }
 * Output: { result: "4" }
 *
 * Handles:
 * - Basic arithmetic operations
 * - Mathematical functions (sqrt, sin, cos, etc)
 * - Unit conversions
 * - Error cases with descriptive messages
 */

export const calculator_tool = async ({
  expression = '',
}: CalculatorToolParams): Promise<ToolResponse> => {
  try {
    // Validate input
    const validated = schema.parse({ expression });
    const math_result = math.evaluate(validated.expression);

    return { result: math_result.toString() };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'calculate-math-expression',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    // Handle math.js errors more descriptively
    if (error instanceof Error) {
      return handle_tool_error(
        'calculate-math-expression',
        `Failed to evaluate expression '${expression}': ${error.message}`
      );
    }
    return handle_tool_error('calculate-math-expression', undefined, error);
  }
};
