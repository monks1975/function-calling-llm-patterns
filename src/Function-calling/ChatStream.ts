import OpenAI from 'openai';
import {
  ChatCompletionMessage,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/resources/chat';

import { list, search, get } from './db';

export class ChatStream {
  private messages: ChatCompletionMessageParam[] = [];
  private openai: OpenAI;
  private tools: OpenAI.Chat.Completions.ChatCompletionTool[];

  constructor(
    openai: OpenAI,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    systemPrompt: string
  ) {
    this.openai = openai;
    this.tools = tools;
    this.messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];
  }

  async processUserInput(userInput: string): Promise<void> {
    this.messages.push({
      role: 'user',
      content: userInput,
    });

    while (true) {
      const message = await this.streamCompletion();
      this.messages.push(message);

      if (!message.tool_calls) {
        return;
      }

      // Handle tool calls
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const result = await this.callTool(toolCall);
        console.log(
          '\nFunction call:',
          toolCall.function.name,
          toolCall.function.arguments
        );
        console.log('Result:', JSON.stringify(result, null, 2), '\n');

        this.messages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result),
        } as OpenAI.Chat.ChatCompletionToolMessageParam);
      }
    }
  }

  private async streamCompletion(): Promise<ChatCompletionMessage> {
    const stream = await this.openai.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: this.messages,
      tools: this.tools,
      stream: true,
    });

    let message = {} as ChatCompletionMessage;
    for await (const chunk of stream) {
      message = this.messageReducer(message, chunk);
      process.stdout.write(chunk.choices[0]?.delta?.content || '');
    }
    console.log();
    return message;
  }

  private async callTool(
    tool_call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
  ): Promise<any> {
    if (tool_call.type !== 'function')
      throw new Error('Unexpected tool_call type:' + tool_call.type);
    const args = JSON.parse(tool_call.function.arguments);
    switch (tool_call.function.name) {
      case 'list':
        return await list(args);
      case 'search':
        return await search(args);
      case 'get':
        return await get(args);
      default:
        throw new Error('No function found');
    }
  }

  private messageReducer(
    previous: ChatCompletionMessage,
    item: ChatCompletionChunk
  ): ChatCompletionMessage {
    const reduce = (acc: any, delta: ChatCompletionChunk.Choice.Delta) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
          if (Array.isArray(acc[key])) {
            for (const arr of acc[key]) {
              delete arr.index;
            }
          }
        } else if (typeof acc[key] === 'string' && typeof value === 'string') {
          acc[key] += value;
        } else if (typeof acc[key] === 'number' && typeof value === 'number') {
          acc[key] = value;
        } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
          const accArray = acc[key];
          for (let i = 0; i < value.length; i++) {
            const { index, ...chunkTool } = value[i];
            accArray[index] = reduce(accArray[index], chunkTool);
          }
        } else if (typeof acc[key] === 'object' && typeof value === 'object') {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    const choice = item.choices[0];
    if (!choice) return previous;
    return reduce(previous, choice.delta) as ChatCompletionMessage;
  }
}
