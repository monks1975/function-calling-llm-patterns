// ~/src/react/react.stream.ts
// stream implementation for the ReAct agent

import { encode, decode } from 'gpt-tokenizer';
import { ReActAgent } from './react.agent';
import { Readable } from 'stream';
import { z } from 'zod';

import type { ReActCallbacks } from './types';

export interface ReActStreamConfig {
  stream_thoughts?: boolean;
  stream_actions?: boolean;
  typing_speed?: 'slow' | 'normal' | 'fast';
  natural_pauses?: boolean;
}

const DEFAULT_STREAM_CONFIG: ReActStreamConfig = {
  stream_thoughts: false,
  stream_actions: false,
  typing_speed: 'normal',
  natural_pauses: false,
};

// Schema for parsing ReACT agent responses
const react_response_schema = z.object({
  thought: z.string().optional(),
  action: z.string().optional(),
  input: z.any().optional(),
  final_answer: z.string().optional(),
});

export class ReActStream {
  private agent: ReActAgent;
  private config: ReActStreamConfig;
  private typing_speeds = {
    slow: { base: 20, variance: 10 },
    normal: { base: 10, variance: 5 },
    fast: { base: 5, variance: 2 },
  };
  private readonly ROUND_DELAY_MS = 100;
  private readonly PUNCTUATION_DELAYS: Record<string, number> = {
    '.': 350,
    '!': 350,
    '?': 350,
    ',': 200,
    ';': 250,
    ':': 250,
  };

  constructor(
    agent: ReActAgent,
    config: ReActStreamConfig = DEFAULT_STREAM_CONFIG
  ) {
    this.agent = agent;
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
  }

  /**
   * Create a readable stream that processes the question and streams the response
   *
   * @param question The user's question to process
   * @param callbacks Optional callbacks for handling events during processing
   * @returns A readable stream that emits the response
   */
  public create_readable_stream(
    question: string,
    external_callbacks?: ReActCallbacks
  ): Readable {
    // Create a readable stream with a simple cleanup handler
    const readable = new Readable({
      read: () => {},
      destroy: (error, callback) => {
        // Abort any pending requests in the agent
        this.agent.abort();

        if (callback) callback(error);
      },
    });

    // Start processing in the background
    this.process_question(question, readable, external_callbacks).catch(
      (error) => {
        readable.destroy(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    );

    return readable;
  }

  private async stream_words(readable: Readable, text: string) {
    // Use GPT tokenizer to break text into natural token chunks
    const tokens = encode(text);
    const speed = this.typing_speeds[this.config.typing_speed || 'normal'];

    // Stream text token by token with natural timing
    let accumulated_text = '';

    for (let i = 0; i < tokens.length; i++) {
      // Decode the current token to text
      const token_text = decode([tokens[i]]);
      accumulated_text += token_text;

      // Add a tiny delay before whitespace at token start to make it feel more natural
      if (token_text.startsWith(' ') || token_text.startsWith('\n')) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(3, speed.base / 4))
        );
      }

      readable.push(token_text);

      // Calculate delay based on token complexity
      const token_length = token_text.length;
      let delay = speed.base * (Math.min(token_length, 4) / 3);

      // Add some randomness for naturality
      delay += (Math.random() * 2 - 1) * speed.variance;

      // Add pauses for punctuation if enabled
      if (this.config.natural_pauses) {
        const last_char = token_text[token_text.length - 1];
        const pause = this.PUNCTUATION_DELAYS[last_char] || 0;

        if (pause > 0) {
          await new Promise((resolve) => setTimeout(resolve, pause));
          continue;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, Math.max(2, delay)));
    }
  }

  private async process_question(
    question: string,
    readable: Readable,
    external_callbacks?: ReActCallbacks
  ) {
    try {
      // Use a promise to track the current streaming operation
      let current_stream_promise = Promise.resolve();

      // Define callbacks for the agent
      const callbacks: ReActCallbacks = {
        // Merge external callbacks with our stream-specific ones
        ...external_callbacks,

        onChunk: (chunk) => {
          // Call external callback if provided
          external_callbacks?.onChunk?.(chunk);

          // Chain the streaming promises to ensure proper sequence
          current_stream_promise = current_stream_promise.then(async () => {
            try {
              const parsed = react_response_schema.parse(JSON.parse(chunk));

              // Stream thoughts if enabled
              if (parsed.thought && this.config.stream_thoughts) {
                readable.push('\n*');
                await this.stream_words(readable, parsed.thought);
                readable.push('*\n');
                await new Promise((resolve) =>
                  setTimeout(resolve, this.ROUND_DELAY_MS)
                );
              }

              // Stream actions if enabled
              if (
                parsed.action &&
                parsed.input !== undefined &&
                this.config.stream_actions
              ) {
                readable.push('\n**');
                await this.stream_words(
                  readable,
                  `${parsed.action} => ${JSON.stringify(parsed.input)}`
                );
                readable.push('**\n');
                await new Promise((resolve) =>
                  setTimeout(resolve, this.ROUND_DELAY_MS)
                );
              }

              // Stream final answer
              if (parsed.final_answer) {
                readable.push('\n');
                await this.stream_words(readable, parsed.final_answer);
                readable.push('\n');
              }
            } catch (e) {
              // If parsing fails, stream the raw chunk
              await this.stream_words(readable, chunk);
            }
          });
        },

        // Merge with external callbacks but ensure we handle tool observations
        onToolObservation: (observation) => {
          // Call external callback if provided
          external_callbacks?.onToolObservation?.(observation);
        },

        // End the stream when we have a final answer
        onFinalAnswer: async (answer) => {
          // Call external callback if provided
          external_callbacks?.onFinalAnswer?.(answer);

          // Wait for all streaming to complete before ending
          await current_stream_promise;
          readable.push(null); // End the stream
        },

        // Handle errors by destroying the stream
        onError: (error) => {
          // Call external callback if provided
          external_callbacks?.onError?.(error);

          readable.destroy(error);
        },
      };

      // Process the question with our callbacks
      await this.agent.answer(question, callbacks);
    } catch (error) {
      // If any error occurs during processing, destroy the stream
      readable.destroy(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
