// ~/src/ReWOO/tools/llm.tool.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from '../../core';

import type { EventBus } from '../events';
import type { ReWooTool } from '../types';

// prettier-ignore
const llm_system_prompt = Handlebars.compile(
  `Today's date: {{today}}

  You are a helpful assistant with a skills at distilling information and solving problems. 
  
  Rules:
  - Answer should be clear, concise and to the point.
  - Answer should not repeat, regurgitate or generate new data which is not analytically derived from the evidence provided.
  - Your answer could be used as evidence for a solution to a problem or used by another LLM, so don't overburden the recipient with an excessive amount of information.
  - Always present your answer in markdown format.
  `
);

export class LlmTool implements ReWooTool {
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
        {
          role: 'system',
          content: llm_system_prompt({ today: new Date().toISOString() }),
        },
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
