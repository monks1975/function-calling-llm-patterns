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

    this.tools = new Map(
      tools.map((tool) => {
        // Attach callbacks to each tool
        if (tool.callbacks === undefined) {
          tool.callbacks = this.tool_callbacks;
        }
        return [tool.name, tool];
      })
    );

    this.fallback_ai = new AiGenerate(ai_config);
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

    if (!tool) {
      console.warn(`Tool "${step.tool}" not found, using fallback AI`);
      return this.execute_fallback(step.tool, processed_args);
    }

    try {
      return await tool.execute(processed_args);
    } catch (error) {
      console.error(`Error executing tool ${step.tool}: ${error}`);
      return this.execute_fallback(step.tool, processed_args);
    }
  }

  private async execute_fallback(
    tool_name: string,
    args: string
  ): Promise<string> {
    this.tool_callbacks?.onExecuteStart?.(args);

    const content = `The tool "${tool_name}" failed to execute with args: "${args}". 
    Please provide the best possible answer using your knowledge.`;

    const result = await this.fallback_ai.get_completion(
      [{ role: 'user', content }],
      undefined,
      {
        onCompletion: (completion) =>
          this.tool_callbacks?.onCompletion?.(completion),
      }
    );

    this.tool_callbacks?.onExecuteComplete?.(result);
    return `(Fallback) ${result}`;
  }
}
