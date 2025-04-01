// ~/src/react/message.handler.ts
// Handles message management and token tracking

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ReActTokenUsage } from './types';

export class ReActMessageHandler {
  private messages: ChatCompletionMessageParam[] = [];
  private token_usage: ReActTokenUsage[] = [];

  add_message(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
  }

  get_messages(): ChatCompletionMessageParam[] {
    return [...this.messages];
  }

  get_context_messages(): ChatCompletionMessageParam[] {
    const systemMessage = this.messages[0]; // system
    const recentMessages = this.messages.slice(1).slice(-5); // last 5 messages
    return [systemMessage, ...recentMessages];
  }

  track_token_usage(usage: ReActTokenUsage): void {
    this.token_usage.push(usage);
  }

  get_token_usage(): ReActTokenUsage[] {
    return [...this.token_usage];
  }

  clear(): void {
    this.messages = [];
    this.token_usage = [];
  }

  clear_token_usage(): void {
    this.token_usage = [];
  }
}
