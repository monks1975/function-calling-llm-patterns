#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';

import OpenAI from 'openai';
import { ChatStream } from './chat-stream';

import { generate_system_prompt } from './instructions';
import { get_tools_by_names } from './tools/repository';
import { convert_tools_for_prompt } from './tools/repository';

import * as readline from 'readline';

// Check for API key
const api_key = process.env.TOGETHER_API_KEY;
if (!api_key) {
  console.error('Error: TOGETHER_API_KEY environment variable is not set');
  console.error('Please create a .env file based on .env.example');
  console.error(
    'Make sure to add your actual Together API key to the .env file'
  );
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: api_key,
});

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Initialize tools and generate system prompt
  const tools = get_tools_by_names(['calculator', 'search_web']);
  const toolDefinitions = convert_tools_for_prompt(tools);
  const system_prompt = generate_system_prompt(toolDefinitions, {
    include_date: true,
  });

  console.log(system_prompt);

  const stream = new ChatStream(openai, system_prompt);

  console.log('Chat started. Type your messages (press Ctrl+C to exit):');

  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('\nYou: ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') {
      break;
    }

    await stream.process_user_input(userInput);
  }

  rl.close();
}

main().catch(console.error);
