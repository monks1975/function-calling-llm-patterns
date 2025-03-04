// ~/src/PlanExecute/tools/llm.tool.ts

import { AiGenerate, type AiConfig } from '../ai';
import { BaseTool } from './base.tool';
import { z } from 'zod';
import dotenv from 'dotenv';

import type { ToolResult } from '../types';

dotenv.config();

const llm_schema = z
  .string()
  .min(1, { message: 'Input is required' })
  .describe('LLM user prompt');

type LlmParams = z.infer<typeof llm_schema>;

const config: AiConfig = {
  api_key: process.env.GROQ_API_KEY || '',
  base_url: 'https://api.groq.com/openai/v1',
  model: 'llama-3.1-8b-instant',
  temperature: 0.7,
  max_tokens: 1024,
  timeout_ms: 10000, // 10 seconds
  max_retries: 3,
};

export class LlmTool extends BaseTool {
  name = 'llm';
  description =
    'A pretrained LLM for general knowledge and reasoning. Prioritize when confident in solving the problem.';
  schema = llm_schema;

  private ai_client: AiGenerate;
  private readonly system_prompt =
    'You are a helpful assistant that is able to consolidate and synthesize information from multiple sources, maintaining a high factual accuracy.';

  constructor() {
    super();
    this.ai_client = new AiGenerate(config);
  }

  protected async execute_validated(params: LlmParams): Promise<ToolResult> {
    try {
      this.ai_client.add_message({
        role: 'system',
        content: this.system_prompt,
      });

      this.ai_client.add_message({ role: 'user', content: params });

      let token_usage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      const response = await this.ai_client.get_completion(
        this.ai_client.get_messages(),
        undefined,
        {
          onRetry: (notification) => console.warn('LLM retry:', notification),
          onCompletion: (completion) => {
            if (completion.usage) {
              token_usage = {
                prompt_tokens: completion.usage.prompt_tokens,
                completion_tokens: completion.usage.completion_tokens,
                total_tokens: completion.usage.total_tokens,
              };
            }
          },
        }
      );

      return {
        status: 'success',
        data: response,
        tokens: token_usage,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.ai_client.reset_messages();
    }
  }
}

// Export singleton instance
export const llm = new LlmTool();
