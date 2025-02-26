// ~/src/ReACT/main.ts
// ReACT Agent CLI
// run with: npm run react-cli

import * as dotenv from 'dotenv';
import * as readline from 'readline';

import { debug } from './logger';
import { Moderator } from './moderation';
import { ReActAgentSingleton } from './react.singleton';
import { ReActStream, type ReActStreamConfig } from './react.stream';

import type { AiConfig, AiRetryNotification } from './ai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { ModerationResult } from './moderation';
import type { Readable } from 'stream';
import type { ToolsConfig } from './tools/setup';

// Load environment variables
dotenv.config();

/**
 * Main function to run the CLI application
 */
async function main() {
  try {
    // Load configuration from environment variables
    const ai_config = load_ai_config();
    const tools_config = load_tools_config();
    const stream_config = load_stream_config();

    // Initialize the agent singleton
    ReActAgentSingleton.initialize(ai_config, tools_config);

    // Get the agent instance
    const agent = ReActAgentSingleton.get_agent();

    // Create the stream for interactive output
    const stream = new ReActStream(agent, stream_config);

    // Set up event listeners
    setup_event_listeners();

    // Start the interactive readline interface
    start_interactive_mode(stream);
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error)
    );
    // Ensure cleanup happens even on error
    ReActAgentSingleton.cleanup();
    process.exit(1);
  }
}

/**
 * Load AI configuration from environment variables
 */
function load_ai_config(): AiConfig {
  // Check for required environment variables
  const cerebras_api_key = process.env.CEREBRAS_API_KEY;
  const openai_api_key = process.env.OPENAI_API_KEY;

  if (!cerebras_api_key) {
    console.error('Error: CEREBRAS_API_KEY environment variable is not set');
    console.error('Please create a .env file based on .env.example');
    console.error(
      'Make sure to add your actual Cerebras API key to the .env file'
    );
    process.exit(1);
  }

  if (!openai_api_key) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create a moderator instance
  const moderator = new Moderator({
    api_key: openai_api_key,
  });

  // Configure AI chat
  return {
    base_url: 'https://api.cerebras.ai/v1',
    api_key: cerebras_api_key,
    model: 'llama3.1-8b',
    max_tokens: 8192,
    temperature: 0.6,
    moderator: moderator,
    moderation_config: {
      blocked_message:
        'This message contained sensitive and/or offensive material and has been removed',
      safeguarding_message: `If you need help with any issues, like bullying or abuse, please contact the Bolton College helpline on 0300 303 8695.`,
    },
  };
}

/**
 * Load tools configuration
 */
function load_tools_config(): ToolsConfig {
  // Configure which tools to enable and their configurations
  return {
    calculator: {
      enabled: true,
    },
    search_web: {
      enabled: true,
    },
    library: {
      enabled: true,
      config: {
        library_name: 'Steve Jobs Isaacson Biography Library',
        library_description:
          'A library focused on the biography of Steve Jobs by Walter Isaacson. It contains detailed information about Steve Jobs life, work, and leadership at Apple.',
        library_uuid: process.env.DOJO_API_LIBRARY_UUID,
      },
    },
  };
}

/**
 * Load stream configuration
 */
function load_stream_config(): ReActStreamConfig {
  // Configure streaming output options for ReACT
  return {
    stream_thoughts: true, // Set to false to hide thoughts
    stream_actions: true, // Set to false to hide action/input
  };
}

/**
 * Set up event listeners for the agent
 */
function setup_event_listeners() {
  // Listen for completion events to log ai request data
  ReActAgentSingleton.on('completion', (completion: ChatCompletion) => {
    debug({ completion }, 'Request completed');
  });

  ReActAgentSingleton.on('retry', (notification: AiRetryNotification) => {
    debug({ notification }, 'Retry');
  });

  ReActAgentSingleton.on(
    'tool-observation',
    (observation: { data: string; is_error: boolean }) => {
      debug({ observation }, 'Tool observation');
    }
  );

  // Add listener for content moderation events
  ReActAgentSingleton.on(
    'content-moderation',
    (moderation_data: {
      original_message: string;
      moderation_result: ModerationResult;
      violated_categories: string[];
    }) => {
      debug(
        {
          original_message: moderation_data.original_message,
          moderation_result: moderation_data.moderation_result,
          violated_categories: moderation_data.violated_categories,
        },
        'Content moderation flagged message'
      );
    }
  );
}

/**
 * Start the interactive readline interface
 */
function start_interactive_mode(stream: ReActStream) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Function to force exit the process
  const forceExit = () => {
    // Try to exit gracefully first
    process.exit(0);

    // If we're still here after 100ms, use SIGKILL on our own process
    setTimeout(() => {
      console.log('Process still running, using SIGKILL...');
      process.kill(process.pid, 'SIGKILL');
    }, 100);
  };

  console.log('ReACT Agent CLI - Enter your questions (type "exit" to quit)\n');

  // Track the current stream to ensure it's properly cleaned up on exit
  let current_stream: Readable | null = null;

  // Create recursive function for asking questions
  const ask_question = () => {
    rl.question('Question: ', async (question: string) => {
      if (question.toLowerCase() === 'exit') {
        console.log('Cleaning up and exiting...');

        // Clean up any active stream
        if (current_stream) {
          current_stream.destroy();
          current_stream = null;
        }

        // Clean up the agent
        ReActAgentSingleton.cleanup();

        // Close the readline interface
        rl.close();

        // Force exit immediately
        console.log('Forcing immediate exit...');
        forceExit();

        // This is a fallback that should never be reached
        return;
      }

      try {
        // Store reference to the current stream
        current_stream = stream.create_readable_stream(question);

        current_stream.on('data', (chunk: Buffer) => {
          process.stdout.write(chunk.toString());
        });

        current_stream.on('error', (error: Error) => {
          debug({ error }, 'Error in readable stream');
          current_stream = null;
        });

        current_stream.on('end', () => {
          current_stream = null;
        });

        await new Promise<void>((resolve) => {
          if (current_stream) {
            current_stream.on('end', resolve);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('Error:', error);
        current_stream = null;
      }

      console.log('\n--------------------------------');
      ask_question(); // Ask for the next question
    });
  };

  ask_question();
}

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };
