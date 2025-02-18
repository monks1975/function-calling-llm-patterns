#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';

import OpenAI from 'openai';

import { ReActAgent } from './react-agent';

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
  const agent = new ReActAgent(openai);
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
