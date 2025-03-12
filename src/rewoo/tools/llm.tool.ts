// ~/src/ReWOO/tools/llm.tool.ts

import { AiGenerate, type AiConfig } from '../ai';

import type { EventBus } from '../events';
import type { Tool } from '../types';

export class LlmTool implements Tool {
  name = 'LLM';
  description =
    'A pretrained LLM like yourself. Useful for general knowledge and reasoning.';
  private ai: AiGenerate;

  constructor(ai_config: AiConfig, private event_bus: EventBus) {
    this.ai = new AiGenerate(ai_config, event_bus);
  }

  async execute(args: string): Promise<string> {
    try {
      const result = await this.ai.get_completion([
        { role: 'user', content: args },
      ]);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event directly
      this.event_bus.emit({
        type: 'error',
        error: err,
        context: 'llm_tool',
      });

      throw err; // Let Worker handle the error for fallback
    }
  }
}
