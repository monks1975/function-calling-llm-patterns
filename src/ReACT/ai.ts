// ~/src/ReACT/ai.ts
// class for AI generation tasks

import { EventEmitter } from 'events';
import Handlebars from 'handlebars';
import OpenAI from 'openai';

import { content_violation } from './react.instructions';
import { Moderator, type ModerationResult } from './moderation';

import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
  ChatCompletion,
} from 'openai/resources/chat/completions';

export interface AiConfig {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  max_retries?: number;
  moderator?: Moderator;
  moderation_config?: {
    blocked_message?: string;
    safeguarding_message?: string;
  };
}

export interface AiRetryNotification {
  type: 'retry';
  attempt: number;
  backoff_ms: number;
  error: string;
}

class AiError extends Error {
  constructor(message: string, public readonly attempt?: number) {
    super(message);
    this.name = 'AiError';
  }
}

export class AiGenerate {
  protected readonly openai: OpenAI;
  protected readonly config: Required<
    Omit<AiConfig, 'moderator' | 'moderation_config'>
  > & {
    moderator?: Moderator;
    moderation_config?: {
      blocked_message?: string;
      safeguarding_message?: string;
    };
  };

  protected abort_controller: AbortController | null = null;
  protected messages: ChatCompletionMessageParam[] = [];
  protected emitter: EventEmitter;

  constructor(config: AiConfig) {
    this.openai = new OpenAI({
      baseURL: config.base_url,
      apiKey: config.api_key,
    });

    this.emitter = new EventEmitter();

    this.config = {
      model: config.model,
      max_tokens: config.max_tokens ?? 8192,
      temperature: config.temperature ?? 0.5,
      timeout_ms: config.timeout_ms ?? 10000,
      max_retries: config.max_retries ?? 3,
      base_url: config.base_url ?? 'https://api.openai.com/v1',
      api_key: config.api_key,
      moderator: config.moderator,
      moderation_config: {
        blocked_message: config.moderation_config?.blocked_message,
        safeguarding_message: config.moderation_config?.safeguarding_message,
      },
    };
  }

  protected async get_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    let attempt = 0;
    let last_error: Error | null = null;

    // Check if the last message is from the user and needs moderation
    if (this.config.moderator && messages.length > 0) {
      const last_message = messages[messages.length - 1];

      if (
        last_message.role === 'user' &&
        typeof last_message.content === 'string'
      ) {
        const moderation_result = await this.config.moderator.moderate(
          last_message.content
        );

        if (moderation_result.flagged) {
          // Emit a content-moderation event with the moderation result and original message
          this.emitter.emit('content-moderation', {
            original_message: last_message.content,
            moderation_result: moderation_result,
            violated_categories: Object.entries(moderation_result.categories)
              .filter(([_, violated]) => violated)
              .map(([category, _]) => category),
          });

          const violated_categories = Object.entries(
            moderation_result.categories
          )
            .filter(([_, violated]) => violated)
            .map(([category, _]) => category);

          // Create a tool observation message about the content warning
          const tool_observation = Handlebars.compile(content_violation)({
            violated_categories: violated_categories.join(', '),
            safeguarding_message:
              this.config.moderation_config?.safeguarding_message,
          });

          // Replace the user's message with the tool observation
          messages = [
            ...messages.slice(0, -1),
            {
              role: 'user',
              content: tool_observation,
            },
          ];

          // Continue with normal processing instead of returning immediately
          // This allows the model to generate its own final answer based on the tool observation
        }
      }
    }

    while (attempt < this.config.max_retries) {
      try {
        return await this.execute_with_timeout(messages, response_format);
      } catch (error) {
        last_error = error instanceof Error ? error : new Error(String(error));

        if (last_error.name === 'AbortError') {
          throw last_error;
        }

        if (!(await this.handle_retry(++attempt, last_error))) {
          break;
        }
      }
    }

    throw new AiError(
      `Failed after ${this.config.max_retries} attempts. Last error: ${last_error?.message}`,
      attempt
    );
  }

  protected async execute_with_timeout(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    this.abort_controller = new AbortController();

    const timeout_promise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new AiError(
          `Request timed out after ${this.config.timeout_ms}ms`
        );
        reject(error);
      }, this.config.timeout_ms);
    });

    try {
      return await Promise.race([
        this.execute(messages, response_format),
        timeout_promise,
      ]);
    } finally {
      this.abort_controller = null;
    }
  }

  protected async execute(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    const completion = await this.openai.chat.completions.create(
      {
        model: this.config.model,
        messages,
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        response_format: response_format,
      },
      {
        signal: this.abort_controller?.signal,
      }
    );

    // Emit the completion response for logging
    this.emitter.emit('completion', completion);

    return completion.choices[0]?.message?.content ?? '';
  }

  protected async handle_retry(
    attempt: number,
    error: Error
  ): Promise<boolean> {
    if (attempt >= this.config.max_retries) {
      return false;
    }

    const backoff_ms = Math.min(
      1000 * Math.pow(2, attempt) + Math.random() * 1000,
      10000
    );

    const notification: AiRetryNotification = {
      type: 'retry',
      attempt,
      backoff_ms,
      error: error.message,
    };

    this.emitter.emit('retry', notification);

    await new Promise((resolve) => setTimeout(resolve, backoff_ms));
    return true;
  }

  public on(
    event: 'retry' | 'completion' | 'content-moderation',
    listener: (
      notification:
        | AiRetryNotification
        | ChatCompletion
        | {
            original_message: string;
            moderation_result: ModerationResult;
            violated_categories: string[];
          }
    ) => void
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  public off(
    event: 'retry' | 'completion' | 'content-moderation',
    listener: (
      notification:
        | AiRetryNotification
        | ChatCompletion
        | {
            original_message: string;
            moderation_result: ModerationResult;
            violated_categories: string[];
          }
    ) => void
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  public abort(): void {
    this.abort_controller?.abort();
  }

  public add_message(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  public get_messages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }
}
