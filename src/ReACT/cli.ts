// ~/src/react/cli.ts
// CLI interface for ReActAgentSingleton

import { blue, green, red, yellow, cyan, gray } from 'ansis';
import * as dotenv from 'dotenv';
import readline from 'readline';

import { ReActAgentSingleton } from './react.singleton';
import { ReActStream } from './react.stream';
import { save_session_log } from './helpers';

import type { AiConfig } from '../core/types/ai';
import type { ReActCallbacks } from './types';
import type { ReActStreamConfig } from './react.stream';
import type { ToolsConfig } from './tools/setup';

dotenv.config();

class ReactCli {
  private rl: readline.Interface;
  private is_running: boolean = true;

  private use_streaming: boolean = true;
  private stream_config: ReActStreamConfig = {
    typing_speed: 'fast',
  };

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private load_config(): { ai_config: AiConfig; tools_config: ToolsConfig } {
    const cerebras_api_key = process.env.CEREBRAS_API_KEY;

    if (!cerebras_api_key) {
      throw new Error('Required API keys not found in environment variables');
    }

    const ai_config: AiConfig = {
      base_url: 'https://api.cerebras.ai/v1',
      api_key: cerebras_api_key,
      model: 'llama-3.3-70b',
      max_tokens: null,
      temperature: 0.6,
      timeout_ms: 30000,
      max_retries: 3,
    };

    const tools_config: ToolsConfig = {
      calculator: { enabled: true },
      search_web: { enabled: true },
      thought: { enabled: true },
      rag: {
        enabled: true,
        config: {
          library_uuid: 'be3fe717-64f1-4014-8b03-01c534aefd30',
          library_name: 'Apple History',
          library_description:
            'A collection of documents about Apple Inc. and its products.',
        },
      },
    };

    return { ai_config, tools_config };
  }

  private async prompt(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(blue('You: '), resolve);
    });
  }

  private async handle_streamed_response(input: string) {
    console.log(green('\nAssistant: '));

    try {
      const callbacks = this.create_callbacks();
      const agent = ReActAgentSingleton.get_agent();
      const stream = new ReActStream(agent, this.stream_config);

      const readable = stream.create_readable_stream(input, callbacks);

      // Process the stream
      for await (const chunk of readable) {
        process.stdout.write(chunk);
      }

      console.log('\n');
    } catch (error: unknown) {
      console.error(
        red('\nStreaming failed, falling back to standard response: ') +
          (error instanceof Error ? error.message : 'Unknown error') +
          '\n'
      );

      try {
        await this.handle_standard_response(input);
      } catch (fallback_error: unknown) {
        const error_message =
          fallback_error instanceof Error
            ? fallback_error.message
            : 'An unknown error occurred';
        console.error(
          red('\nError in fallback response: ') + error_message + '\n'
        );
      }
    }
  }

  private async handle_standard_response(input: string) {
    try {
      const callbacks = this.create_callbacks();
      const response = await ReActAgentSingleton.answer(input, callbacks);
      console.log(green('Response: ') + response + '\n');
    } catch (error: unknown) {
      const error_message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      throw new Error(`Standard response failed: ${error_message}`);
    }
  }

  private handle_exit() {
    console.log(yellow('\nGoodbye! 👋\n'));
    this.is_running = false;
    ReActAgentSingleton.cleanup();
    this.rl.close();
    process.exit(0);
  }

  private create_callbacks(): ReActCallbacks {
    return {
      onToolObservation: (observation: {
        data: string;
        is_error: boolean;
      }) => {},
      onChunk: (chunk: string) => {},
      onIteration: (iteration: number) => {},
      onFinalAnswer: async (answer: string) => {
        const state = ReActAgentSingleton.current_state;

        if (!state) {
          console.log(gray('\nNo state available'));
          return;
        }

        try {
          await save_session_log(state);
        } catch (error) {
          console.error(red('\nError saving session log: ') + error);
        }
      },
    };
  }

  public async start() {
    try {
      const { ai_config, tools_config } = this.load_config();
      ReActAgentSingleton.initialize(ai_config, tools_config);

      console.log(cyan('\nReAct CLI - Type "q", "quit" or "clear" to exit\n'));
      console.log(cyan('Commands:'));
      console.log(
        cyan('  toggle_mode - Switch between streaming and standard mode')
      );
      console.log(
        cyan('  toggle_stream - Toggle streaming of thoughts and actions')
      );
      console.log(
        cyan('  toggle_thoughts - Toggle streaming of thoughts only')
      );
      console.log(
        cyan('  toggle_actions - Toggle streaming of actions only\n')
      );

      while (this.is_running) {
        const input = await this.prompt();

        if (['q', 'quit', 'clear'].includes(input.toLowerCase())) {
          this.handle_exit();
          break;
        }

        if (input.toLowerCase() === 'toggle_mode') {
          this.use_streaming = !this.use_streaming;
          console.log(
            yellow(
              `Using ${this.use_streaming ? 'streaming' : 'standard'} mode`
            )
          );
          continue;
        }

        if (input.toLowerCase() === 'toggle_stream') {
          const current =
            this.stream_config.stream_thoughts &&
            this.stream_config.stream_actions;
          this.stream_config.stream_thoughts = !current;
          this.stream_config.stream_actions = !current;
          console.log(
            yellow(
              `Streaming ${
                !current ? 'enabled' : 'disabled'
              } for thoughts and actions`
            )
          );
          continue;
        }

        if (input.toLowerCase() === 'toggle_thoughts') {
          this.stream_config.stream_thoughts =
            !this.stream_config.stream_thoughts;
          console.log(
            yellow(
              `Thought streaming ${
                this.stream_config.stream_thoughts ? 'enabled' : 'disabled'
              }`
            )
          );
          continue;
        }

        if (input.toLowerCase() === 'toggle_actions') {
          this.stream_config.stream_actions =
            !this.stream_config.stream_actions;
          console.log(
            yellow(
              `Action streaming ${
                this.stream_config.stream_actions ? 'enabled' : 'disabled'
              }`
            )
          );
          continue;
        }

        if (this.use_streaming) {
          await this.handle_streamed_response(input);
        } else {
          await this.handle_standard_response(input);
        }
      }
    } catch (error) {
      console.error(
        red('\nError: ') +
          (error instanceof Error
            ? error.message
            : 'Failed to initialize ReAct CLI')
      );
      ReActAgentSingleton.cleanup();
      process.exit(1);
    }
  }
}

// Start the CLI
const cli = new ReactCli();
cli.start();
