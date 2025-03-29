// ~/src/ReACT/cli.ts
// CLI interface for ReActAgentSingleton

import { blue, green, red, yellow, cyan, gray } from 'ansis';
import readline from 'readline';
import * as dotenv from 'dotenv';

import { ReActAgentSingleton } from './react.singleton';

import type { AiConfig } from '../core/types/ai';
import type { ToolsConfig } from './tools/setup';
import type { ReActCallbacks } from './types';

dotenv.config();

class ReactCli {
  private rl: readline.Interface;
  private is_running: boolean = true;

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
    };

    return { ai_config, tools_config };
  }

  private async prompt(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(blue('You: '), resolve);
    });
  }

  private async handle_response(response: string) {
    console.log(green('\nAssistant: ') + response + '\n');
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
      onToolObservation: (observation: { data: string; is_error: boolean }) => {
        const color = observation.is_error ? red : gray;
        console.log(color('\nTool Observation: ') + observation.data);
      },
      onChunk: (chunk: string) => {
        // console.log(cyan('\nResponse: ') + chunk);
      },
      onIteration: (iteration: number) => {
        console.log(gray(`\nIteration ${iteration}`));
      },
      onFinalAnswer: (answer: string) => {
        const state = ReActAgentSingleton.current_state;

        if (!state) {
          console.log(gray('\nNo state available'));
          return;
        }

        console.log(gray(JSON.stringify(state, null, 2)));
      },
    };
  }

  public async start() {
    try {
      const { ai_config, tools_config } = this.load_config();
      ReActAgentSingleton.initialize(ai_config, tools_config);

      console.log(cyan('\nReAct CLI - Type "q" to quit\n'));

      while (this.is_running) {
        const input = await this.prompt();

        if (input.toLowerCase() === 'q') {
          this.handle_exit();
          break;
        }

        try {
          const callbacks = this.create_callbacks();

          const response = await ReActAgentSingleton.answer(input, callbacks);
          await this.handle_response(response);
        } catch (error: unknown) {
          const error_message =
            error instanceof Error
              ? error.message
              : 'An unknown error occurred';
          console.error(red('\nError: ') + error_message + '\n');
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
