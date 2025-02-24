// ~/src/ReACT/ai.stream.ts
// stream implementation for the AI generation class

import { AiGenerate } from './ai';

import type { AiConfig } from './ai';

import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface StreamOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class AiGenerateStream extends AiGenerate {
  constructor(config: AiConfig) {
    super(config);
  }

  public async stream(
    messages: ChatCompletionMessageParam[] = this.get_messages(),
    options: StreamOptions = {},
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    let attempt = 0;
    let last_error: Error | null = null;
    let accumulated_content = '';

    while (attempt < this.config.max_retries) {
      try {
        accumulated_content = await this.execute_stream_with_timeout(
          messages,
          options,
          response_format
        );
        return accumulated_content;
      } catch (error) {
        last_error = error instanceof Error ? error : new Error(String(error));

        if (last_error.name === 'AbortError') {
          options.onError?.(last_error);
          throw last_error;
        }

        if (!(await this.handle_retry(++attempt, last_error))) {
          break;
        }
      }
    }

    const final_error = new Error(
      `Failed after ${this.config.max_retries} attempts. Last error: ${last_error?.message}`
    );
    options.onError?.(final_error);
    throw final_error;
  }

  protected async execute_stream_with_timeout(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions,
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    this.abort_controller = new AbortController();

    const timeout_promise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          `Request timed out after ${this.config.timeout_ms}ms`
        );
        reject(error);
      }, this.config.timeout_ms);
    });

    try {
      return await Promise.race([
        this.execute_stream(messages, options, response_format),
        timeout_promise,
      ]);
    } finally {
      this.abort_controller = null;
    }
  }

  protected async execute_stream(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions,
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    const stream = await this.openai.chat.completions.create(
      {
        model: this.config.model,
        messages,
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        response_format: response_format,
        stream: true,
      },
      {
        signal: this.abort_controller?.signal,
      }
    );

    let accumulated_content = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      accumulated_content += content;

      options.onChunk?.({
        content,
        done: false,
      });
    }

    options.onChunk?.({
      content: '',
      done: true,
    });

    options.onComplete?.();
    return accumulated_content;
  }
}
