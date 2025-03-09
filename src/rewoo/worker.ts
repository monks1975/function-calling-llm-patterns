// ~/src/ReWOO/worker.ts

import { AiGenerate, type AiConfig } from './ai';

import type { Step, Tool, ToolCallbacks } from './types';

export class Worker {
  private tools: Map<string, Tool>;
  private fallback_ai: AiGenerate;
  private tool_callbacks?: ToolCallbacks;

  constructor(
    tools: Tool[],
    ai_config: AiConfig,
    tool_callbacks?: ToolCallbacks
  ) {
    this.tool_callbacks = tool_callbacks;
    this.fallback_ai = new AiGenerate(ai_config);

    // Initialize tools map with callbacks
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  async cleanup(): Promise<void> {
    // Clear callbacks
    this.tool_callbacks = undefined;

    // Clear tools map
    this.tools.clear();

    // Cleanup any tools that have cleanup methods
    for (const tool of this.tools.values()) {
      if ('cleanup' in tool && typeof tool.cleanup === 'function') {
        await tool.cleanup();
      }
    }
  }

  async execute_step(
    step: Step,
    results: Record<string, string> = {}
  ): Promise<string> {
    // Process variable substitutions in the args
    let processed_args = step.args;
    for (const [key, value] of Object.entries(results)) {
      processed_args = processed_args.replace(key, value);
    }

    // Get the tool and execute it
    const tool = this.tools.get(step.tool);

    this.tool_callbacks?.onExecuteStart?.(processed_args);

    try {
      let result: string;

      if (!tool) {
        console.warn(`Tool "${step.tool}" not found, using fallback AI`);
        result = await this.execute_fallback(step.tool, processed_args);
      } else {
        // If it's an LLM tool, ensure it has the callbacks
        if (tool.name === 'LLM' && 'callbacks' in tool) {
          tool.callbacks = this.tool_callbacks;
        }
        result = await tool.execute(processed_args);
      }

      this.tool_callbacks?.onExecuteComplete?.(result, step);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.tool_callbacks?.onExecuteError?.(err);
      return this.execute_fallback(step.tool, processed_args);
    }
  }

  private async execute_fallback(
    tool_name: string,
    args: string
  ): Promise<string> {
    const content = `The tool "${tool_name}" failed to execute with args: "${args}". 
    Please provide the best possible answer using your knowledge.`;

    const result = await this.fallback_ai.get_completion(
      [{ role: 'user', content }],
      undefined,
      {
        onCompletion: (completion) => {
          this.tool_callbacks?.onCompletion?.(completion, 'worker', tool_name);
        },
      }
    );

    return `(Fallback) ${result}`;
  }
}
