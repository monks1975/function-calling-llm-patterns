#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';
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
