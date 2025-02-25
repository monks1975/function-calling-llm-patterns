// ~/src/ReACT/react.stream.ts
// stream implementation for the ReAct agent

import { ReActAgent } from './react.agent';
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
  private readonly WORD_DELAY_MS = 25;
  private readonly WORD_DELAY_VARIANCE = 15; // Add up to ±15ms variance
  private readonly ROUND_DELAY_MS = 500;
  private config: ReActStreamConfig;

  constructor(
    agent: ReActAgent,
    config: ReActStreamConfig = DEFAULT_STREAM_CONFIG
  ) {
    this.agent = agent;
    this.config = { ...DEFAULT_STREAM_CONFIG, ...config };
  }

  public create_readable_stream(question: string): Readable {
    const readable = new Readable({ read: () => {} });

    this.stream_response(question, readable).catch((error) => {
      readable.destroy(error);
    });

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

  private async stream_response(question: string, readable: Readable) {
    try {
      let current_stream_promise = Promise.resolve();

      // Set up event handlers for the agent
      this.agent
        .on('chunk', (chunk) => {
          // Chain the streaming promises
          current_stream_promise = current_stream_promise.then(async () => {
            try {
              const parsed = react_response_schema.parse(JSON.parse(chunk));

              if (parsed.thought && this.config.stream_thoughts) {
                readable.push('\n*');
                await this.stream_words(readable, parsed.thought);
                readable.push('*\n');
                await new Promise((resolve) =>
                  setTimeout(resolve, this.ROUND_DELAY_MS)
                );
              }

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

              if (parsed.final_answer) {
                readable.push('\n');
                await this.stream_words(readable, parsed.final_answer);
                readable.push('\n');
              }
            } catch (e) {
              // If we can't parse as JSON or it doesn't match our schema, stream the raw chunk
              await this.stream_words(readable, chunk);
            }
          });
        })
        .on('tool-observation', (observation) => {
          // Observations are handled externally, no logging needed
        })
        .on('final-answer', async () => {
          // Wait for all streaming to complete before ending the stream
          await current_stream_promise;
          readable.push(null); // End the stream
        })
        .on('error', (error) => {
          readable.destroy(error);
        });

      // Start the agent's processing
      await this.agent.answer(question);
    } catch (error) {
      readable.destroy(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
