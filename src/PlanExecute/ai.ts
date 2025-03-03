// ~/src/PlanExecute/ai.ts
// class for AI generation tasks

import OpenAI from 'openai';

import type { Moderator } from './moderation';

import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
  ChatCompletion,
} from 'openai/resources/chat/completions';

export interface AiConfig {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number | null;
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
  status?: number;
  headers?: Record<string, string>;
  errorDetails?: Record<string, any>;
}

export interface AiCallbacks {
  onRetry?: (notification: AiRetryNotification) => void;
  onCompletion?: (completion: ChatCompletion) => void;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly attempt?: number,
    public readonly status?: number,
    public readonly headers?: Record<string, string>,
    public readonly errorDetails?: Record<string, any>
  ) {
    super(message);
    this.name = 'AiError';
  }
}

// New error class for content moderation issues
export class ContentModerationError extends AiError {
  constructor(
    message: string,
    attempt?: number,
    status?: number,
    headers?: Record<string, string>,
    errorDetails?: Record<string, any>
  ) {
    super(message, attempt, status, headers, errorDetails);
    this.name = 'ContentModerationError';
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

  constructor(config: AiConfig) {
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
      base_url: config.base_url ?? 'https://api.openai.com/v1',
      api_key: config.api_key,
      moderator: config.moderator,
      moderation_config: {
        blocked_message: config.moderation_config?.blocked_message,
        safeguarding_message: config.moderation_config?.safeguarding_message,
      },
    };
  }

  public async get_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format'],
    callbacks?: AiCallbacks
  ): Promise<string> {
    let attempt = 0;
    let last_error: AiError | Error | null = null;

    while (attempt < this.config.max_retries) {
      try {
        return await this.execute_with_timeout(
          messages,
          response_format,
          callbacks
        );
      } catch (error) {
        // Extract OpenAI API error details if available
        if (error instanceof OpenAI.APIError) {
          const status = error.status;
          const headers = error.headers as Record<string, string>;
          const errorDetails = {
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message,
          };

          // Check for content moderation errors
          if (
            error.code === 'content_filter' ||
            error.message.includes('content management policy') ||
            error.message.includes('violates OpenAI') ||
            error.message.includes('content policy') ||
            error.message.includes('flagged') ||
            error.message.includes('moderation')
          ) {
            // Don't retry content moderation errors
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
          throw last_error;
        }

        if (!(await this.handle_retry(++attempt, last_error, callbacks))) {
          break;
        }
      }
    }

    if (last_error instanceof AiError) {
      throw last_error;
    } else {
      throw new AiError(
        `Failed after ${this.config.max_retries} attempts. Last error: ${last_error?.message}`,
        attempt
      );
    }
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
          `Request timed out after ${this.config.timeout_ms}ms`
        );
        reject(error);
      }, this.config.timeout_ms);
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

    // Notify via callback instead of event
    callbacks?.onCompletion?.(completion);

    return completion.choices[0]?.message?.content ?? '';
  }

  protected async handle_retry(
    attempt: number,
    error: Error,
    callbacks?: AiCallbacks
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

    // Add additional error details if available
    if (error instanceof AiError) {
      notification.status = error.status;
      notification.headers = error.headers;
      notification.errorDetails = error.errorDetails;
    }

    // Notify via callback instead of event
    callbacks?.onRetry?.(notification);

    await new Promise((resolve) => setTimeout(resolve, backoff_ms));
    return true;
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

  public reset_messages(): void {
    // Keep only the first message (system prompt) if it exists
    this.messages = this.messages.length > 0 ? [this.messages[0]] : [];
  }

  public cleanup(): void {
    // Abort any pending requests
    this.abort();

    // Clear message history to help garbage collection
    this.messages = [];
  }
}
