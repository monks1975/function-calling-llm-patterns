// ~/src/PlanExecute/base.agent.ts

import { AiGenerate, AiConfig, AiCallbacks } from './ai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AgentConfig extends AiConfig {
  system_prompt?: string;
}

export class BaseAgent extends AiGenerate {
  protected system_prompt?: string;

  constructor(config: AgentConfig) {
    super(config);
    this.system_prompt = config.system_prompt;

    // Initialize with system prompt if provided
    if (this.system_prompt) {
      this.add_message({
        role: 'system',
        content: this.system_prompt,
      });
    }
  }

  /**
   * Add a user message to the conversation
   */
  public add_user_message(content: string): void {
    this.add_message({ role: 'user', content });
  }

  /**
   * Add an assistant message to the conversation
   */
  public add_assistant_message(content: string): void {
    this.add_message({ role: 'assistant', content });
  }

  /**
   * Get a completion from the model formatted as JSON
   */
  public async get_json_completion(callbacks?: AiCallbacks): Promise<string> {
    const messages = this.get_messages();
    const response_format = { type: 'json_object' as const };
    return await this.get_completion(messages, response_format, callbacks);
  }

  /**
   * Protected method to be called by subclasses for completions
   */
  protected async get_completion_internal(
    messages: ChatCompletionMessageParam[],
    response_format?: { type: 'json_object' },
    callbacks?: AiCallbacks
  ): Promise<string> {
    return super.get_completion(messages, response_format, callbacks);
  }

  /**
   * Helper function to parse JSON with retries and model feedback
   */
  protected async parse_json_with_retries<T>(
    json_str: string,
    max_attempts: number = 3,
    feedback_context: string = ''
  ): Promise<T> {
    let last_error: Error | null = null;

    for (let attempt = 1; attempt <= max_attempts; attempt++) {
      try {
        return JSON.parse(json_str) as T;
      } catch (error) {
        last_error = error instanceof Error ? error : new Error(String(error));

        if (attempt === max_attempts) break;

        // Add feedback about the error to the model
        this.add_user_message(
          `Your last response contained invalid JSON. Error: ${last_error.message}\n` +
            `Context: ${feedback_context}\n` +
            'Please provide a corrected JSON response.'
        );

        // Get new completion
        json_str = await this.get_json_completion();
      }
    }

    throw new Error(
      `Failed to parse JSON after ${max_attempts} attempts. Last error: ${last_error?.message}`
    );
  }
}
