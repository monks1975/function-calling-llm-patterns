// ~/src/PlanExecute/tools/calculator.tool.ts

import { ToolResult } from '../types';
import { z } from 'zod';
import * as math from 'mathjs';
import { BaseTool } from './base.tool';

// Define input schema to only accept string
const calculator_schema = z
  .string()
  .min(1, 'Input is required')
  .describe('Calculator expression input');

type CalculatorInput = z.infer<typeof calculator_schema>;

/**
 * Calculator tool for mathematical operations using mathjs
 */
export class CalculatorTool extends BaseTool {
  name = 'calculator';
  description = 'Calculate mathematical expressions using mathjs';
  schema = calculator_schema;

  private normalize_expression(expr: string): string {
    return (
      expr
        // Remove LaTeX math delimiters
        .replace(/[\[\]\\]/g, '')
        // Replace LaTeX times symbol
        .replace(/\\times/g, '*')
        // Remove multiple spaces
        .replace(/\s+/g, ' ')
        // Trim whitespace
        .trim()
        // Replace x/X with * for multiplication
        .replace(/([0-9])\s*[xX]\s*([0-9])/g, '$1*$2')
        // Add missing zero before decimal
        .replace(/([^0-9])\.([0-9])/g, '$10.$2')
        // Remove comma separators in numbers
        .replace(/(\d),(\d)/g, '$1$2')
        // Convert percentages to decimals
        .replace(/(\d+)%/g, '($1/100)')
    );
  }

  protected async execute_validated(
    params: CalculatorInput
  ): Promise<ToolResult> {
    try {
      const normalized = this.normalize_expression(params);
      const result = math.evaluate(normalized);

      return {
        status: 'success',
        data: {
          expression: params,
          normalized_expression: normalized,
          result: result.toString(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export tool instance
export const calculator = new CalculatorTool();
