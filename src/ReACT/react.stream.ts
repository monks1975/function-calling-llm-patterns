// ~/src/react/react.stream.ts
// stream implementation for the ReAct agent

import { ReActAgent, type ReActCallbacks } from './react.agent';
import { Readable } from 'stream';
import { z } from 'zod';

export interface ReActStreamConfig {
  stream_thoughts?: boolean;
  stream_actions?: boolean;
}

const DEFAULT_STREAM_CONFIG: ReActStreamConfig = {
  stream_thoughts: false,
  stream_actions: false,
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
  private readonly WORD_DELAY_MS = 25;
  private readonly WORD_DELAY_VARIANCE = 15; // Add up to ±15ms variance
  private readonly ROUND_DELAY_MS = 500;

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
    const words = text.split(/(\s+)/); // Split on whitespace but keep the whitespace
    for (const word of words) {
      readable.push(word);
      // Calculate a random delay between (base - variance) and (base + variance)
      const randomDelay =
        this.WORD_DELAY_MS + (Math.random() * 2 - 1) * this.WORD_DELAY_VARIANCE;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(10, randomDelay))
      );
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
