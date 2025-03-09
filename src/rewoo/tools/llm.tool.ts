// ~/src/ReWOO/tools/llm.tool.ts

import { AiGenerate, type AiConfig } from '../ai';
import type { Tool, ReWOOEventEmitter, ToolCallbacks } from '../types';

export class LlmTool implements Tool {
  name = 'LLM';
  description =
    'A pretrained LLM like yourself. Useful for general knowledge and reasoning.';
  private ai: AiGenerate;
  emitter?: ReWOOEventEmitter;
  private callbacks?: ToolCallbacks;

  constructor(ai_config: AiConfig, callbacks?: ToolCallbacks) {
    this.ai = new AiGenerate(ai_config);
    this.callbacks = callbacks;
  }

  async execute(args: string): Promise<string> {
    try {
      this.callbacks?.onExecuteStart?.(args);

      const result = await this.ai.get_completion(
        [{ role: 'user', content: args }],
        undefined,
        {
          onCompletion: (completion) => {
            this.callbacks?.onCompletion?.(completion, 'tool', this.name);
          },
        }
      );

      this.callbacks?.onExecuteComplete?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks?.onExecuteError?.(err);
      throw err;
    }
  }
}
