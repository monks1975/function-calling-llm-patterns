// ~/src/ReACT/ai.stream.ts

import OpenAI from 'openai';
import { Readable } from 'stream';
import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions';
import { EventEmitter } from 'events';

export interface AIChatStreamConfig {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  max_retries?: number;
}

export interface RetryNotification {
  type: 'retry';
  attempt: number;
  backoff_ms: number;
  error: string;
}

class StreamError extends Error {
  constructor(message: string, public readonly attempt?: number) {
    super(message);
    this.name = 'StreamError';
  }
}

export class AIChatStream {
  private readonly openai: OpenAI;
  private readonly config: Required<AIChatStreamConfig>;
  private abort_controller: AbortController | null = null;
  private messages: ChatCompletionMessageParam[] = [];
  private emitter: EventEmitter;

  constructor(config: AIChatStreamConfig) {
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

  public create_readable_stream(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Readable {
    const readable = new Readable({ read: () => {} });

    this.stream_completion(messages, response_format, readable).catch((error) =>
      readable.destroy(error)
    );

    return readable;
  }

  private async stream_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    readable?: Readable
  ): Promise<string> {
    let attempt = 0;
    let last_error: Error | null = null;

    while (attempt < this.config.max_retries) {
      try {
        return await this.execute_stream_with_timeout(
          messages,
          response_format,
          readable
        );
      } catch (error) {
        last_error = error instanceof Error ? error : new Error(String(error));

        if (last_error.name === 'AbortError') {
          readable?.destroy(last_error);
          throw last_error;
        }

        if (!(await this.handle_retry(++attempt, last_error, readable))) {
          break;
        }
      }
    }

    const final_error = new StreamError(
      `Failed after ${this.config.max_retries} attempts. Last error: ${last_error?.message}`,
      attempt
    );
    readable?.destroy(final_error);
    throw final_error;
  }

  private async execute_stream_with_timeout(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    readable?: Readable
  ): Promise<string> {
    this.abort_controller = new AbortController();

    const timeout_promise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new StreamError(
          `Request timed out after ${this.config.timeout_ms}ms`
        );
        reject(error);
      }, this.config.timeout_ms);
    });

    try {
      return await Promise.race([
        this.execute_stream(messages, response_format, readable),
        timeout_promise,
      ]);
    } finally {
      this.abort_controller = null;
    }
  }

  private async execute_stream(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    readable?: Readable
  ): Promise<string> {
    const runner = this.openai.beta.chat.completions.stream(
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

    let response_text = '';

    runner.on('chunk', (chunk) => {
      const content = chunk.choices[0]?.delta?.content ?? '';
      if (content) {
        response_text += content;
        if (readable) readable.push(content);
      }
    });

    await runner.finalChatCompletion();
    readable?.push(null);

    return response_text;
  }

  private async handle_retry(
    attempt: number,
    error: Error,
    readable?: Readable
  ): Promise<boolean> {
    if (attempt >= this.config.max_retries) {
      return false;
    }

    const backoff_ms = Math.min(
      1000 * Math.pow(2, attempt) + Math.random() * 1000,
      10000
    );

    const notification: RetryNotification = {
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
    listener: (notification: RetryNotification) => void
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  public off(
    event: 'retry',
    listener: (notification: RetryNotification) => void
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  public abort_stream(): void {
    this.abort_controller?.abort();
  }

  public add_message(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  public get_messages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }
}
