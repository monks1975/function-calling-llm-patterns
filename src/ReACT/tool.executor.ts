// ~/src/ReACT/tool.executor.ts
// Handles tool execution and mapping

import type { ToolDefinition } from './tools/setup';
import type { ToolResponse } from './tools/helpers';
import type { ReActToolState } from './types';
import { ReActToolError } from './errors';

export class ReActToolExecutor {
  private state: ReActToolState;

  constructor(state: ReActToolState) {
    this.state = state;
  }

  get_tool(action: string): ToolDefinition | null {
    if (!action || typeof action !== 'string') {
      throw new ReActToolError(
        'Invalid action: action must be a non-empty string'
      );
    }

    const normalized_action = action.toLowerCase();
    const primary_name = this.state.tool_name_map.get(normalized_action);
    return primary_name ? this.state.tools.get(primary_name) || null : null;
  }

  get_available_tools(): string[] {
    return Array.from(this.state.tools.values()).map((t) => t.name);
  }

  async execute(action: string, input: unknown): Promise<string> {
    const tool = this.get_tool(action);

    if (!tool) {
      throw new ReActToolError(`Tool '${action}' not found`, {
        available_tools: this.get_available_tools(),
        tool_name: action,
      });
    }

    try {
      const parsed_input =
        typeof input === 'string' ? JSON.parse(input) : input;

      if (!parsed_input) {
        throw new ReActToolError('Tool input cannot be null or undefined', {
          input,
        });
      }

      const response = (await tool.execute(parsed_input)) as ToolResponse;

      if (!response) {
        throw new ReActToolError('Tool execution returned no response');
      }

      if (response.error) {
        throw new ReActToolError(response.error);
      }

      return (
        response.result || 'Tool execution completed but returned no result'
      );
    } catch (error) {
      if (error instanceof ReActToolError) {
        throw error;
      }
      throw new ReActToolError(
        error instanceof Error ? error.message : String(error),
        { input }
      );
    }
  }
}
