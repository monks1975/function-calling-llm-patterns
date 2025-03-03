// ~/src/PlanExecute/tools/llm.tool.ts

import { AiGenerate, type AiConfig } from '../ai';
import { BaseTool } from './base.tool';
import { z } from 'zod';
import dotenv from 'dotenv';

import type { ToolResult } from '../types';

dotenv.config();

const llm_schema = z.string().min(1, { message: 'Input is required' });

type LlmParams = z.infer<typeof llm_schema>;

const config: AiConfig = {
  api_key: process.env.GROQ_API_KEY || '',
  base_url: 'https://api.groq.com/openai/v1',
  model: 'llama-3.1-8b-instant',
  temperature: 0.7,
  max_tokens: 4096,
  timeout_ms: 10000, // 10 seconds
  max_retries: 3,
};

export class LlmTool extends BaseTool {
  name = 'llm';
  description =
    'LLM[input]: A pretrained LLM for general knowledge and reasoning. Prioritize when confident in solving the problem. Input can be any instruction.';
  schema = llm_schema;
  required_params = ['input'];

  private ai_client: AiGenerate;
  private readonly system_prompt =
    'You are a helpful assistant that is able to consolidate and synthesize information from multiple sources, maintaining a high factual accuracy. The material given to you is your sole source of knowledge, and you should use it to answer the question fully and accurately.';

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

      const response = await this.ai_client.get_completion(
        this.ai_client.get_messages(),
        undefined,
        {
          onRetry: (notification) => console.warn('LLM retry:', notification),
        }
      );

      return {
        status: 'success',
        data: response,
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
