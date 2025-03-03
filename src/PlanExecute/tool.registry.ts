// ~/src/PlanExecute/tool.registry.ts

import { ToolDefinition, ToolRegistry } from './types';

/**
 * Implementation of the ToolRegistry interface
 * Provides a central place to register and access tools
 * Future Benefits:
 * - Tool validation and verification
 * - Dynamic tool loading/unloading
 * - Tool usage metrics and monitoring
 * - Access control and permissions
 * - Tool versioning and compatibility checks
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools: Record<string, ToolDefinition> = {};

  /**
   * Register a tool with the registry
   * @param tool The tool to register
   */
  register(tool: ToolDefinition): void {
    this.tools[tool.name] = tool;
  }

  /**
   * Get a tool by name
   * @param name The name of the tool to get
   * @returns The tool, or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools[name];
  }

  /**
   * Get all registered tools
   * @returns A record of all tools
   */
  get_all(): Record<string, ToolDefinition> {
    return { ...this.tools };
  }

  /**
   * Get all registered tool names
   * @returns An array of tool names
   */
  get_tool_names(): string[] {
    return Object.keys(this.tools);
  }
}
