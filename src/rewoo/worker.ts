// ~/src/rewoo/worker.ts

import { AiGenerate, type AiConfig } from '../core';

import type { EventBus } from './events';
import type { ReWooStep, ReWooTool } from './types';

export class Worker {
  private tools: Map<string, ReWooTool>;
  private fallback_ai: AiGenerate;
  private event_bus: EventBus;

  constructor(ai_config: AiConfig, tools: ReWooTool[], event_bus: EventBus) {
    this.fallback_ai = new AiGenerate(ai_config, event_bus);
    this.event_bus = event_bus;

    // Initialize tools map
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  async cleanup(): Promise<void> {
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
    step: ReWooStep,
    results: Record<string, string> = {}
  ): Promise<string> {
    // Process variable substitutions in the args
    let processed_args = step.args;
    for (const [key, value] of Object.entries(results)) {
      processed_args = processed_args.replace(key, value);
    }

    // Get the tool and execute it
    const tool = this.tools.get(step.tool);

    // Emit tool start event
    this.event_bus.emit({
      type: 'tool_start',
      step,
      args: processed_args,
    });

    try {
      let result: string;

      if (!tool) {
        console.warn(`Tool "${step.tool}" not found, using fallback AI`);
        result = await this.execute_fallback(step.tool, processed_args);
      } else {
        result = await tool.execute(processed_args);
      }

      // Emit tool complete event
      this.event_bus.emit({
        type: 'tool_complete',
        step,
        result,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.event_bus.emit({
        type: 'error',
        error: err,
        context: 'tool_execution',
        step,
      });

      // Use fallback on error
      return this.execute_fallback(step.tool, processed_args);
    }
  }

  private async execute_fallback(
    tool_name: string,
    args: string
  ): Promise<string> {
    const content = `The tool "${tool_name}" failed to execute with args: "${args}". 
    Please provide the best possible answer using your knowledge.`;

    // Emit fallback start event
    this.event_bus.emit({
      type: 'info',
      message: `Using fallback for tool "${tool_name}"`,
    });

    const result = await this.fallback_ai.get_completion([
      { role: 'user', content },
    ]);

    // The fallback AI will emit its own completion event via the event_bus

    return `(Fallback) ${result}`;
  }
}
