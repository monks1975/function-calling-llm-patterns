#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';
import { cyan, green, inverse, red } from 'ansis';
import * as readline from 'readline';

import { ReActAgent } from './react.agent';

import type { AIChatStreamConfig } from './ai.stream';

const api_key = process.env.TOGETHER_API_KEY;

if (!api_key) {
  console.error('Error: TOGETHER_API_KEY environment variable is not set');
  console.error('Please create a .env file based on .env.example');
  console.error(
    'Make sure to add your actual Together API key to the .env file'
  );
  process.exit(1);
}

// Configure AI chat stream
const ai_config: AIChatStreamConfig = {
  base_url: 'https://api.together.xyz/v1',
  api_key: api_key,
  model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  max_tokens: 6144,
  temperature: 0.5,
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

  // Set up event handlers
  agent
    .on('chunk', (chunk) => {
      // Custom chunk handling could go here
      // For now we'll keep the default stdout behavior
      process.stdout.write(chunk);
    })
    .on('tool-observation', (observation) => {
      log_to_console(
        observation.is_error ? 'error' : 'info',
        'Tool Observation',
        observation.data
      );
    })
    .on('final-answer', (answer) => {
      log_to_console('info', 'Final Answer', answer);
    })
    .on('iteration', (count) => {
      log_to_console('info', 'Iteration', count.toString());
    })
    .on('error', (error) => {
      log_to_console('error', 'Error', error.message);
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
        rl.close();
        return;
      }

      try {
        await agent.answer(question);
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

function log_to_console(type: 'info' | 'error', tag: string, message: string) {
  if (type === 'info') {
    console.log(green`\n\n${inverse`${tag}`} ${message}\n`);
  } else {
    console.log(red`\n\n${inverse`${tag}`} ${message}\n`);
  }
}
