// ~/src/ReWOO/tools/calculator.tool.ts

import { ReWooTool } from '../types';

export class CalculatorTool implements ReWooTool {
  name = 'Calculator';
  description =
    'A tool for performing mathematical calculations. Input must be a valid math.js expression.';

  private extract_numbers_from_text(text: string): number[] {
    // Remove commas from numbers
    const no_commas = text.replace(/(\d),(\d)/g, '$1$2');

    // Look for patterns like "X is Y" where Y is a number
    const is_pattern = /\b(?:is|equals|=)\s+(\d+(?:\.\d+)?)/i;
    const is_match = no_commas.match(is_pattern);
    if (is_match && is_match[1]) {
      return [parseFloat(is_match[1])];
    }

    // Extract all numbers from the text
    const number_pattern = /\b(\d+(?:\.\d+)?)\b/g;
    const matches = [...no_commas.matchAll(number_pattern)];
    return matches.map((match) => parseFloat(match[1]));
  }

  private process_expression(input: string): string {
    // Remove commas from numbers
    let processed = input.replace(/(\d),(\d)/g, '$1$2');

    // Check for parenthesized expressions
    const parenthesis_pattern = /\([^\(\)]*\)/g;
    const has_parenthesis = parenthesis_pattern.test(processed);

    // If input is a clean math expression, return it
    if (/^[\d\s\+\-\*\/\^\(\)\.\%]*$/.test(processed)) {
      return processed;
    }

    // If input contains text, process it
    if (/[a-zA-Z]/.test(processed)) {
      // Handle complex expressions with parentheses
      if (has_parenthesis) {
        // Process each parenthesized group
        processed = processed.replace(/\(([^\(\)]*)\)/g, (match, group) => {
          // If the group contains text, extract numbers
          if (/[a-zA-Z]/.test(group)) {
            const numbers = this.extract_numbers_from_text(group);
            if (numbers.length > 0) {
              // Use the largest number
              return numbers.sort((a, b) => b - a)[0].toString();
            }
            return '0';
          }
          return match; // Keep unchanged if no text
        });
      }

      // Split by operators to handle expressions like "X - Y"
      const parts = processed.split(/(\s*[\+\-\*\/\^]\s*)/);

      // Process each part
      const processed_parts = parts.map((part) => {
        // If part is an operator, keep it
        if (/^\s*[\+\-\*\/\^]\s*$/.test(part)) {
          return part;
        }

        // If part contains text, extract numbers
        if (/[a-zA-Z]/.test(part)) {
          const numbers = this.extract_numbers_from_text(part);
          if (numbers.length > 0) {
            // Use the largest number (likely the main value)
            return numbers.sort((a, b) => b - a)[0].toString();
          }
          return '0'; // Default if no numbers found
        }

        return part; // Return unchanged if no text
      });

      return processed_parts.join('').trim();
    }

    return processed;
  }

  async execute(args: string): Promise<string> {
    if (!args || args.trim() === '') {
      return 'No input provided for calculation';
    }

    try {
      const math = await import('mathjs');

      // Process the input to extract a valid expression
      const processed_args = this.process_expression(args);

      // Evaluate the expression
      const math_result = math.evaluate(processed_args);

      // Return only the result, without any additional information
      return math_result.toString();
    } catch (error: unknown) {
      // If evaluation fails, try to extract and return just the numbers
      const numbers = this.extract_numbers_from_text(args);

      if (numbers.length > 0) {
        // If we have two numbers and a minus sign, assume subtraction
        if (numbers.length === 2 && args.includes('-')) {
          // Determine order based on position in the string
          const firstPos = args.indexOf(
            numbers[0].toString().replace('.', '\\.')
          );
          const secondPos = args.indexOf(
            numbers[1].toString().replace('.', '\\.')
          );

          if (firstPos < secondPos) {
            return (numbers[0] - numbers[1]).toString();
          } else {
            return (numbers[1] - numbers[0]).toString();
          }
        }

        // If we have a multiplication sign, try to multiply the numbers
        if (args.includes('*') && numbers.length >= 2) {
          return (numbers[0] * numbers[1]).toString();
        }

        // If we have a plus sign, try to add the numbers
        if (args.includes('+') && numbers.length >= 2) {
          return (numbers[0] + numbers[1]).toString();
        }

        // If we have a division sign, try to divide the numbers
        if (args.includes('/') && numbers.length >= 2) {
          return (numbers[0] / numbers[1]).toString();
        }

        // Otherwise, return the first number found
        return numbers[0].toString();
      }

      if (error instanceof Error) {
        return `Failed to evaluate expression: ${error.message}`;
      }
      return 'An unknown error occurred while calculating';
    }
  }
}
