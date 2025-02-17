#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';
import OpenAI from 'openai';
import { createInterface } from 'readline';
import { ChatStream } from './ChatStream';

// Check for API key
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('Error: GROQ_API_KEY environment variable is not set');
  console.error('Please create a .env file based on .env.example');
  console.error('Make sure to add your actual Groq API key to the .env file');
  process.exit(1);
}

// gets API Key from environment variable GROQ_API_KEY
const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey,
});

/**
 * Note, this will automatically ensure the model returns valid JSON,
 * but won't ensure it conforms to your schema.
 *
 * For that functionality, please see the `tool-call-helpers-zod.ts` example,
 * which shows a fully typesafe, schema-validating version.
 */
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list',
      description:
        'list queries books by genre, and returns a list of names of books and their popularity',
      parameters: {
        type: 'object',
        properties: {
          genre: {
            type: 'string',
            enum: [
              'mystery',
              'nonfiction',
              'memoir',
              'romance',
              'historical',
              'funny',
            ],
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description:
        'search queries books by their name and returns a list of book names and their ids',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get',
      description:
        "get returns a book's detailed information based on the id of the book. Note that this does not accept names, and only IDs, which you can get by using search.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
  },
];

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const chatStream = new ChatStream(
    openai,
    tools,
    'Please use our book database, which you can access using functions to answer the following questions.'
  );

  console.log('Welcome to the Book Assistant! Type "exit" to quit.\n');

  while (true) {
    const userInput = await new Promise<string>((resolve) => {
      rl.question('> ', resolve);
    });

    if (userInput.toLowerCase() === 'exit') {
      break;
    }

    await chatStream.processUserInput(userInput);
  }

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
