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

export const examples = [
  // Example 1: Basic arithmetic
  'User: What is 234 multiplied by 15?\n' +
    'Thought: I need to multiply these numbers together.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "234 * 15" }\n' +
    '<HALT>',

  // Example 2: Multi-step calculation
  'User: What is 15% of $80, then divided by 3?\n' +
    'Thought: I can calculate this in one step: first convert 15% to 0.15, multiply by 80, then divide by 3.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "(80 * 0.15) / 3" }\n' +
    '<HALT>',

  // Example 3: Error handling with invalid expression
  'User: What is 5 times minus 3?\n' +
    'Thought: Let me calculate 5 multiplied by negative 3.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "5 times -3" }\n' +
    'Observation: { "error": "Invalid expression: \'times\' is not a valid operator" }\n' +
    'Thought: I need to use the correct multiplication operator.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "5 * -3" }\n' +
    '<HALT>',

  // Example 4: Complex calculation with parentheses
  'User: Calculate (45 + 32) × (12 - 7) ÷ 3\n' +
    "Thought: I'll maintain the order of operations using parentheses.\n" +
    'Action: Calculator\n' +
    'Action Input: { "expression": "((45 + 32) * (12 - 7)) / 3" }\n' +
    '<HALT>',

  // Example 5: Percentage calculations
  "User: If something costs $50 and there's a 20% discount, what's the final price?\n" +
    'Thought: I need to subtract 20% from $50. I can calculate this by multiplying $50 by (1 - 0.20).\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "50 * (1 - 0.20)" }\n' +
    '<HALT>',

  // Example 6: Scientific notation
  'User: What is 1.5 million times 2.3 thousand?\n' +
    'Thought: I can use scientific notation to make this clearer.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "1.5e6 * 2.3e3" }\n' +
    '<HALT>',

  // Example 7: Error handling with division by zero
  'User: What is 100 divided by 0?\n' +
    'Thought: This is a division by zero operation.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "100 / 0" }\n' +
    'Observation: { "error": "Division by zero" }\n' +
    'Thought: Division by zero is undefined in mathematics. I should explain this.\n' +
    'Action: null\n' +
    'Action Input: null\n' +
    'Final Answer: Division by zero is undefined in mathematics. This operation cannot be performed.\n' +
    '<HALT>',

  // Example 8: Rounding and decimal places
  'User: What is 355 divided by 113 rounded to 4 decimal places?\n' +
    'Thought: I can use the round function with the division.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "round(355 / 113, 4)" }\n' +
    '<HALT>',

  // Example 9: Unit conversion calculation
  'User: Convert 5.5 feet to inches\n' +
    'Thought: I need to multiply feet by 12 to get inches.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "5.5 * 12" }\n' +
    '<HALT>',

  // Example 10: Error recovery with syntax correction
  'User: What is the square root of 144?\n' +
    "Thought: I'll calculate the square root.\n" +
    'Action: Calculator\n' +
    'Action Input: { "expression": "sqrt[144]" }\n' +
    'Observation: { "error": "Invalid expression: unexpected token \'[\'" }\n' +
    'Thought: I need to use the correct syntax for square root.\n' +
    'Action: Calculator\n' +
    'Action Input: { "expression": "sqrt(144)" }\n' +
    '<HALT>',
];
