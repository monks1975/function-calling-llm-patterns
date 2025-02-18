// ~/src/REACT-COT/tools/calculator.ts

import { z } from 'zod';
import * as math from 'mathjs';

import {
  handle_tool_error,
  log_tool,
  zod_schema_to_description,
} from './helpers';

import type { ToolResponse } from './helpers';

export const schema = z.object({
  expression: z.string().min(1, 'Expression is required'),
});

export const json_schema = zod_schema_to_description(schema);

export type CalculatorInput = z.infer<typeof schema>;

/**
 * Calculator Tool
 *
 * A tool for evaluating mathematical expressions using the math.js library.
 * Validates input using Zod schema and returns the calculated result as a string.
 *
 * Input: Mathematical expression as a string
 * Output: Object containing result as string or error message
 *
 * Example:
 * Input: "2 + 2"
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
}: CalculatorInput): Promise<ToolResponse> => {
  try {
    // Validate input
    const result = schema.parse({ expression });

    const math_result = math.evaluate(result.expression);
    log_tool.tool('calculator', result, { results: math_result.toString() });
    return { results: math_result.toString() };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'calculate-math-expression',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('calculate-math-expression', undefined, error);
  }
};
