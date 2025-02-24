// ~/src/ReACT/ai.ts
// class for AI generation tasks

import { EventEmitter } from 'events';
import OpenAI from 'openai';

import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions';

export interface AiConfig {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  max_retries?: number;
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
  protected readonly config: Required<AiConfig>;
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
    };
  }

  protected async get_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    let attempt = 0;
    let last_error: Error | null = null;

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
    event: 'retry',
    listener: (notification: AiRetryNotification) => void
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  public off(
    event: 'retry',
    listener: (notification: AiRetryNotification) => void
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
