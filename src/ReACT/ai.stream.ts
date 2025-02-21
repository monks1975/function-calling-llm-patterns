// ~/src/ReACT/ai.stream.ts

import OpenAI from 'openai';

import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsBase,
} from 'openai/resources/chat/completions';

export interface AIChatStreamConfig {
  base_url?: string;
  api_key: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export class AIChatStream {
  protected openai: OpenAI;
  protected messages: ChatCompletionMessageParam[];
  protected model: string;
  protected max_tokens: number;
  protected temperature: number;
  protected abort_controller: AbortController | null;

  constructor(config: AIChatStreamConfig) {
    this.openai = new OpenAI({
      baseURL: config.base_url,
      apiKey: config.api_key,
    });

    this.messages = [];
    this.model = config.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';
    this.max_tokens = config.max_tokens || 8192;
    this.temperature = config.temperature || 0.5;
    this.abort_controller = null;
  }

  protected async stream_completion(
    messages: ChatCompletionMessageParam[],
    response_format?: ChatCompletionCreateParamsBase['response_format']
  ): Promise<string> {
    // Create new abort controller for this stream
    this.abort_controller = new AbortController();

    try {
      const stream = await this.openai.chat.completions.create(
        {
          model: this.model,
          messages: messages,
          stream: true,
          max_tokens: this.max_tokens,
          temperature: this.temperature,
          response_format: response_format,
        },
        {
          signal: this.abort_controller.signal,
        }
      );

      let response_text = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        response_text += content;
        process.stdout.write(content);
      }

      return response_text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Stream was aborted by user');
      }
      throw error;
    } finally {
      this.abort_controller = null;
    }
  }

  public abort_stream(): void {
    if (this.abort_controller) {
      this.abort_controller.abort();
    }
  }

  protected add_message(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  protected get_messages(): ChatCompletionMessageParam[] {
    return this.messages;
  }
}
