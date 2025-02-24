// ~/src/ReACT/main.ts
// ReACT Agent CLI

import 'dotenv/config';
import { red, inverse } from 'ansis';
import * as readline from 'readline';

import { debug } from './logger';
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

// Configure AI chat stream
// works with together and cerebras currently, not groq (TODO: add groq support)
const ai_config: AiConfig = {
  base_url: 'https://api.cerebras.ai/v1',
  api_key: api_key,
  model: 'llama3.1-8b',
  max_tokens: 8192,
  temperature: 0.2,
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
    debug(
      {
        completion: completion,
      },
      'Request completed'
    );
  });

  // Listen for retries if you want to log those too
  agent.on('retry', (notification) => {});

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
          console.error(red`\n\n${inverse`Error`} ${error.message}\n`);
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
