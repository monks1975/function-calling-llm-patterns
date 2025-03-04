// ~/src/PlanExecute/base.agent.ts

import { AiGenerate, AiConfig, AiCallbacks } from './ai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

export interface AgentConfig extends AiConfig {
  system_prompt?: string;
}

export class BaseAgent extends AiGenerate {
  protected system_prompt?: string;
  protected log_handlers: ((
    level: string,
    message: string,
    data?: any
  ) => void)[] = [];

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
   * Add a log handler to receive parsing and validation errors
   */
  public add_log_handler(
    handler: (level: string, message: string, data?: any) => void
  ): void {
    this.log_handlers.push(handler);
  }

  protected log_error(message: string, data?: any): void {
    console.error(`[BaseAgent] ${message}`);
    this.log_handlers.forEach((handler) => handler('error', message, data));
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
   * Helper function to parse and validate JSON against a schema with retries
   */
  protected async parse_and_validate_json<T>(
    json_str: string,
    schema: z.ZodSchema<T>,
    max_attempts: number = 3,
    feedback_context: string = ''
  ): Promise<T> {
    let last_error: Error | null = null;
    let parsed_json: any;

    for (let attempt = 1; attempt <= max_attempts; attempt++) {
      try {
        // First try to parse the JSON
        if (!parsed_json) {
          try {
            parsed_json = JSON.parse(json_str);
          } catch (parse_error) {
            this.log_error(`Attempt ${attempt}: JSON Parse Error`, {
              error:
                parse_error instanceof Error
                  ? parse_error.message
                  : String(parse_error),
              json_str: json_str.substring(0, 100) + '...',
            });
            throw parse_error;
          }
        }

        // Then validate against schema
        return schema.parse(parsed_json);
      } catch (error) {
        last_error = error instanceof Error ? error : new Error(String(error));

        if (attempt === max_attempts) break;

        // Prepare error feedback
        let error_message = '';
        if (error instanceof z.ZodError) {
          error_message = error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('\n');
          error_message = `Schema validation failed:\n${error_message}`;

          this.log_error(`Attempt ${attempt}: Schema Validation Error`, {
            errors: error.errors,
            context: feedback_context,
          });
        } else {
          error_message = last_error.message;
          this.log_error(`Attempt ${attempt}: General Error`, {
            error: error_message,
            context: feedback_context,
          });
        }

        // Add feedback about the error to the model
        this.add_user_message(
          `Your last response was invalid. Error: ${error_message}\n` +
            `Context: ${feedback_context}\n` +
            'Please provide a corrected response that matches the required schema.'
        );

        // Get new completion and reset parsed_json
        json_str = await this.get_json_completion();
        parsed_json = null;
      }
    }

    const final_error = `Failed to parse and validate JSON after ${max_attempts} attempts. Last error: ${last_error?.message}`;
    this.log_error('Max Retries Exceeded', {
      attempts: max_attempts,
      last_error: last_error?.message,
      context: feedback_context,
    });
    throw new Error(final_error);
  }
}
