// ~/src/PlanExecute/tools/base.tool.ts

import { z } from 'zod';
import { ToolDefinition, ToolResult } from '../types';

/**
 * Validates tool input against its schema
 */
export async function validate_tool_input<T>(
  tool: ToolDefinition,
  params: any
): Promise<T> {
  try {
    return await tool.schema.parseAsync(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid parameters for tool ${tool.name}: ${error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`
      );
    }
    throw error;
  }
}

/**
 * Base class for implementing tools with common functionality
 */
export abstract class BaseTool implements ToolDefinition {
  abstract name: string;
  abstract description: string;
  abstract schema: z.ZodType<any>;
  abstract required_params?: string[];

  /**
   * Template method for tool execution with validation
   */
  async execute(params: any): Promise<ToolResult> {
    try {
      // Validate input
      const validated = await validate_tool_input(this, params);

      // Execute tool-specific logic
      return await this.execute_validated(validated);
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Tool-specific execution logic to be implemented by subclasses
   */
  protected abstract execute_validated(params: any): Promise<ToolResult>;
}
