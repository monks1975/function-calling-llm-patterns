// ~/src/ReACT/ai.stream.ts

import OpenAI from 'openai';
import { Readable } from 'stream';
import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';

interface StreamEvents {
  on_chunk?: (chunk: ChatCompletionChunk) => void;
  on_completion?: (completion: OpenAI.Chat.ChatCompletion) => void;
  on_timeout?: (timeout_ms: number) => void;
  on_retry?: (attempt: number, backoff_ms: number, error: Error) => void;
  on_error?: (error: Error, attempts_made: number) => void;
}

export interface AIChatStreamConfig extends StreamEvents {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  max_retries?: number;
  stream_mode?: 'raw' | 'readable';
}

class StreamError extends Error {
  constructor(message: string, public readonly attempt?: number) {
    super(message);
    this.name = 'StreamError';
  }
}

export class AIChatStream {
  private readonly openai: OpenAI;
  private readonly config: Required<
    Omit<AIChatStreamConfig, keyof StreamEvents>
  >;
  private readonly events: StreamEvents;
  private abort_controller: AbortController | null = null;
  private messages: ChatCompletionMessageParam[] = [];

  constructor(config: AIChatStreamConfig) {
    this.openai = new OpenAI({
      baseURL: config.base_url,
      apiKey: config.api_key,
    });

    this.config = {
      model: config.model,
      max_tokens: config.max_tokens ?? 8192,
      temperature: config.temperature ?? 0.5,
      timeout_ms: config.timeout_ms ?? 10000,
      max_retries: config.max_retries ?? 3,
      stream_mode: config.stream_mode ?? 'raw',
      base_url: config.base_url ?? 'https://api.openai.com/v1',
      api_key: config.api_key,
    };

    this.events = {
      on_chunk: config.on_chunk,
      on_completion: config.on_completion,
      on_timeout: config.on_timeout,
      on_retry: config.on_retry,
      on_error: config.on_error,
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
        this.events.on_timeout?.(this.config.timeout_ms);
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

    if (this.events.on_chunk || readable) {
      runner.on('chunk', (chunk) => {
        const content = chunk.choices[0]?.delta?.content ?? '';

        this.events.on_chunk?.(chunk);
        if (readable && content) readable.push(content);

        if (content) {
          response_text += content;
          if (!readable) process.stdout.write(content);
        }
      });
    }

    const completion = await runner.finalChatCompletion();
    this.events.on_completion?.(completion);
    readable?.push(null);

    return response_text;
  }

  private async handle_retry(
    attempt: number,
    error: Error,
    readable?: Readable
  ): Promise<boolean> {
    if (attempt >= this.config.max_retries) {
      this.events.on_error?.(error, attempt);
      return false;
    }

    const backoff_ms = Math.min(
      1000 * Math.pow(2, attempt) + Math.random() * 1000,
      10000
    );

    this.events.on_retry?.(attempt, backoff_ms, error);

    if (readable) {
      readable.push(
        JSON.stringify({
          type: 'retry',
          attempt,
          backoff_ms,
          error: error.message,
        }) + '\n'
      );
    }

    await new Promise((resolve) => setTimeout(resolve, backoff_ms));
    return true;
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
