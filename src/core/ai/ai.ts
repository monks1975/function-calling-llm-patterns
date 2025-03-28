// ~/src/core/ai/ai.ts
// Core AI generation functionality

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions';
import type { EventBus } from '../types/events';
import type { AiConfig, AiCallbacks, AiName } from '../types/ai';
import { AiError, ContentModerationError } from './errors';

export class AiGenerate {
  protected readonly openai: OpenAI;
  protected readonly ai_config: Required<AiConfig>;
  protected readonly name?: AiName;
  protected abort_controller: AbortController | null = null;
  protected messages: ChatCompletionMessageParam[] = [];
  private event_bus?: EventBus;

  constructor(config: AiConfig, event_bus?: EventBus, name?: AiName) {
    this.openai = new OpenAI({
      baseURL: config.base_url,
      apiKey: config.api_key,
    });
    this.event_bus = event_bus;
    this.name = name;

    this.ai_config = {
      model: config.model,
      max_tokens: config.max_tokens ?? 8192,
      temperature: config.temperature ?? 0.5,
      timeout_ms: config.timeout_ms ?? 10000,
      max_retries: config.max_retries ?? 3,
      base_url: config.base_url ?? 'https://api.openai.com/v1',
      api_key: config.api_key,
    };
  }

  public async get_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    callbacks?: AiCallbacks
  ): Promise<string> {
    let attempt = 0;
    let last_error: AiError | Error | null = null;

    while (attempt < this.ai_config.max_retries) {
      try {
        return await this.execute_with_timeout(
          messages,
          response_format,
          callbacks
        );
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          const status = error.status;
          const headers = error.headers as Record<string, string>;
          const errorDetails = {
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message,
          };

          if (
            error.code === 'content_filter' ||
            error.message.includes('content management policy') ||
            error.message.includes('violates OpenAI') ||
            error.message.includes('content policy') ||
            error.message.includes('flagged') ||
            error.message.includes('moderation')
          ) {
            if (this.event_bus) {
              this.event_bus.emit({
                type: 'error',
                error: new ContentModerationError(
                  error.message,
                  attempt + 1,
                  status,
                  headers,
                  errorDetails
                ),
                context: 'content_moderation',
              });
            }

            throw new ContentModerationError(
              error.message,
              attempt + 1,
              status,
              headers,
              errorDetails
            );
          }

          last_error = new AiError(
            error.message,
            attempt + 1,
            status,
            headers,
            errorDetails
          );
        } else {
          last_error =
            error instanceof Error ? error : new Error(String(error));
        }

        if (last_error.name === 'AbortError') {
          if (this.event_bus) {
            this.event_bus.emit({
              type: 'error',
              error: last_error,
              context: 'request_aborted',
            });
          }
          throw last_error;
        }

        if (!(await this.handle_retry(++attempt, last_error, callbacks))) {
          break;
        }
      }
    }

    const final_error =
      last_error instanceof AiError
        ? last_error
        : new AiError(
            `Failed after ${this.ai_config.max_retries} attempts. Last error: ${last_error?.message}`,
            attempt
          );

    if (this.event_bus) {
      this.event_bus.emit({
        type: 'error',
        error: final_error,
        context: 'max_retries_exceeded',
      });
    }

    throw final_error;
  }

  protected async execute_with_timeout(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    callbacks?: AiCallbacks
  ): Promise<string> {
    this.abort_controller = new AbortController();

    const timeout_promise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new AiError(
          `Request timed out after ${this.ai_config.timeout_ms}ms`
        );
        reject(error);
      }, this.ai_config.timeout_ms);
    });

    try {
      return await Promise.race([
        this.execute(messages, response_format, callbacks),
        timeout_promise,
      ]);
    } finally {
      this.abort_controller = null;
    }
  }

  protected async execute(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    callbacks?: AiCallbacks
  ): Promise<string> {
    const completion = await this.openai.chat.completions.create(
      {
        model: this.ai_config.model,
        messages,
        max_tokens: this.ai_config.max_tokens,
        temperature: this.ai_config.temperature,
        response_format: response_format,
      },
      {
        signal: this.abort_controller?.signal,
      }
    );

    if (this.event_bus) {
      this.event_bus.emit({
        type: 'completion',
        completion,
        source: this.name ?? 'llm',
      });
    }

    callbacks?.onCompletion?.(completion);

    return completion.choices[0]?.message?.content ?? '';
  }

  protected async handle_retry(
    attempt: number,
    error: Error,
    callbacks?: AiCallbacks
  ): Promise<boolean> {
    if (attempt >= this.ai_config.max_retries) {
      return false;
    }

    if (this.event_bus) {
      this.event_bus.emit({
        type: 'retry',
        error,
        context: `attempt_${attempt}`,
      });
    }

    callbacks?.onRetry?.(attempt, error);

    // Exponential backoff
    await new Promise((resolve) =>
      setTimeout(resolve, Math.pow(2, attempt) * 1000)
    );

    return true;
  }

  public async get_embedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0]?.embedding ?? [];
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new AiError(
          error.message,
          undefined,
          error.status,
          error.headers as Record<string, string>,
          {
            type: error.type,
            code: error.code,
            param: error.param,
          }
        );
      }
      throw error;
    }
  }

  public abort(): void {
    this.abort_controller?.abort();
  }

  public add_message(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  public get_messages(): ChatCompletionMessageParam[] {
    return this.messages;
  }

  public reset_messages(): void {
    this.messages = [];
  }

  public cleanup(): void {
    this.reset_messages();
    this.abort();
  }
}
