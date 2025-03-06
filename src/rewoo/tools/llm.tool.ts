// ~/src/ReWOO/tools/llm.tool.ts

import { AiGenerate, type AiConfig } from '../ai';

import type { Tool } from '../types';

export class LlmTool implements Tool {
  name = 'LLM';
  description =
    'A pretrained LLM like yourself. Useful for general knowledge and reasoning.';
  private ai: AiGenerate;

  constructor(ai_config: AiConfig) {
    this.ai = new AiGenerate(ai_config);
  }

  async execute(args: string): Promise<string> {
    return await this.ai.get_completion([{ role: 'user', content: args }]);
  }
}
