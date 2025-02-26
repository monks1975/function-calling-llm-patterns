// ~/src/ReACT/main.ts
// ReACT Agent CLI
// run with: npm run react-cli

import 'dotenv/config';
import * as readline from 'readline';

import { debug } from './logger';
import { Moderator } from './moderation';
import { ReActAgent } from './react.agent';
import { ReActStream, type ReActStreamConfig } from './react.stream';

import type { AiConfig } from './ai';

const api_key = process.env.CEREBRAS_API_KEY;

if (!api_key) {
  console.error('Error: CEREBRAS_API_KEY environment variable is not set');
  console.error('Please create a .env file based on .env.example');
  console.error(
    'Make sure to add your actual Cerebras API key to the .env file'
  );
  process.exit(1);
}

const mod_api_key = process.env.OPENAI_API_KEY;

if (!mod_api_key) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Create a moderator instance
const moderator = new Moderator({
  api_key: mod_api_key,
});

// Configure AI chat stream
// works with together and cerebras currently, not groq (TODO: add groq support)
const ai_config: AiConfig = {
  base_url: 'https://api.cerebras.ai/v1',
  api_key: api_key,
  model: 'llama3.1-8b',
  max_tokens: 8192,
  temperature: 0.2,
  moderator: moderator,
  moderation_config: {
    blocked_message:
      'This message contained sensitive and/or offensive material and has been removed',
    safeguarding_message: `If you need help with any issues, like bullying or abuse, please contact the Bolton College helpline on 0300 303 8695.`,
  },
};

// Configure streaming output options for ReACT
const stream_config: ReActStreamConfig = {
  stream_thoughts: true, // Set to false to hide thoughts
  stream_actions: true, // Set to false to hide action/input
};

// Configure which tools to enable and their configurations
const tools_config = {
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

async function main() {
  const agent = new ReActAgent(ai_config, tools_config);
  const stream = new ReActStream(agent, stream_config);

  // Listen for completion events to log ai request data
  agent.on('completion', (completion) => {
    debug({ completion }, 'Request completed');
  });

  agent.on('retry', (notification) => {
    debug({ notification }, 'Retry');
  });

  agent.on('tool-observation', (observation) => {
    debug({ observation }, 'Tool observation');
  });

  // Add listener for content moderation events
  agent.on('content-moderation', (moderation_data) => {
    debug(
      {
        original_message: moderation_data.original_message,
        moderation_result: moderation_data.moderation_result,
        violated_categories: moderation_data.violated_categories,
      },
      'Content moderation flagged message'
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('ReACT Agent CLI - Enter your questions (type "exit" to quit)\n');

  // Create recursive function for asking questions
  const askQuestion = () => {
    rl.question('Question: ', async (question) => {
      if (question.toLowerCase() === 'exit') {
        agent.cleanup(); // Make sure to cleanup event listeners
        rl.close();
        return;
      }

      try {
        const readable = stream.create_readable_stream(question);

        readable.on('data', (chunk) => {
          process.stdout.write(chunk.toString());
        });

        readable.on('error', (error) => {
          debug({ error }, 'Error in readable stream');
        });

        await new Promise((resolve) => readable.on('end', resolve));
      } catch (error) {
        console.error('Error:', error);
      }

      console.log('\n--------------------------------');
      askQuestion(); // Ask for the next question
    });
  };

  askQuestion();
}

main().catch(console.error);
