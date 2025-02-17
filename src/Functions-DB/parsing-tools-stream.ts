#!/usr/bin/env -S npm run tsn -T

import 'dotenv/config';

import OpenAI from 'openai';
import z from 'zod';
import { zodFunction } from 'openai/helpers/zod';
import readline from 'readline';

// Check for API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is not set');
  console.error('Please create a .env file based on .env.example');
  console.error('Make sure to add your actual OpenAI API key to the .env file');
  process.exit(1);
}

const Table = z.enum(['orders']);

const Column = z.enum([
  'orderId',
  'customerName',
  'products',
  'totalPrice',
  'orderDate',
]);

const Operator = z.enum([
  '=',
  '>',
  '<',
  '<=',
  '>=',
  '!=',
  'contains',
  'startsWith',
  'endsWith',
]);

const OrderBy = z.enum(['asc', 'desc']);

const ProductFilter = z.object({
  name: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
});

const Condition = z.object({
  column: Column,
  operator: Operator,
  value: z.union([z.string(), z.number(), z.array(z.string()), ProductFilter]),
});

const openai = new OpenAI();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// System message to guide the model
const SYSTEM_MESSAGE: OpenAI.Chat.ChatCompletionSystemMessageParam = {
  role: 'system',
  content: `You are a database query assistant. The database contains order information with the following structure:
- orderId (string): unique identifier for each order
- customerName (string): name of the customer
- products (array): list of products with name, quantity, and price
- totalPrice (number): total order price
- orderDate (string): date of the order

You can use the following operators:
- =, >, <, <=, >=, != for numbers and dates
- contains, startsWith, endsWith for strings
- Product filtering with minPrice, maxPrice, minQuantity, maxQuantity

Examples:
- Find orders with total price > 500
- Find orders containing specific products
- Find orders by customer name
- Find orders within date ranges
- Find orders with product quantities or price ranges`,
};

// Keep track of conversation history
const messageHistory: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
  SYSTEM_MESSAGE,
];

async function processUserInput(userInput: string) {
  // Add user message to history
  messageHistory.push({ role: 'user', content: userInput });

  // Clean up message history to only include essential conversation elements
  const cleanMessages: Array<OpenAI.Chat.ChatCompletionMessageParam> = [
    SYSTEM_MESSAGE,
    ...messageHistory
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => {
        if (msg.role === 'user') {
          return { role: 'user' as const, content: msg.content || '' };
        }
        return { role: 'assistant' as const, content: msg.content || '' };
      }),
  ];

  const runner = openai.beta.chat.completions
    .runTools({
      model: 'gpt-4o-2024-08-06',
      messages: cleanMessages,
      stream: true,
      tools: [
        zodFunction({
          name: 'query',
          function: (args) => {
            return { table_name: args.table_name, data: fakeOrders };
          },
          parameters: z.object({
            table_name: Table,
            columns: z.array(Column),
            conditions: z.array(Condition),
            order_by: OrderBy,
          }),
        }),
      ],
    })
    .on('content', (content) => process.stdout.write(content));

  await runner.done();

  // Add assistant messages to history, but only keep the content
  const assistantMessages: Array<OpenAI.Chat.ChatCompletionMessageParam> =
    runner.messages
      .filter((msg) => msg.role === 'assistant')
      .map((msg) => ({
        role: 'assistant' as const,
        content: msg.content || '',
      }));

  messageHistory.push(...assistantMessages);

  // Prompt for next query
  promptUser();
}

function promptUser() {
  console.log(''); // Add blank line before prompt
  rl.question('Enter your query (or type "exit" to quit): ', (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      process.exit(0);
    }
    console.log(''); // Add blank line after input
    processUserInput(input);
  });
}

async function main() {
  console.log('Welcome to the Natural Language Query Interface');
  console.log('You can ask questions about orders, customers, and products');
  console.log('Example: "What are the last 10 orders?"');
  console.log(''); // Add blank line before first prompt
  promptUser();
}

const fakeOrders = [
  {
    orderId: 'ORD-001',
    customerName: 'Alice Johnson',
    products: [{ name: 'Wireless Headphones', quantity: 1, price: 89.99 }],
    totalPrice: 89.99,
    orderDate: '2024-08-02',
  },
  {
    orderId: 'ORD-002',
    customerName: 'Bob Smith',
    products: [
      { name: 'Smartphone Case', quantity: 2, price: 19.99 },
      { name: 'Screen Protector', quantity: 1, price: 9.99 },
    ],
    totalPrice: 49.97,
    orderDate: '2024-08-03',
  },
  {
    orderId: 'ORD-003',
    customerName: 'Carol Davis',
    products: [
      { name: 'Laptop', quantity: 1, price: 999.99 },
      { name: 'Mouse', quantity: 1, price: 29.99 },
    ],
    totalPrice: 1029.98,
    orderDate: '2024-08-04',
  },
  {
    orderId: 'ORD-004',
    customerName: 'David Wilson',
    products: [{ name: 'Coffee Maker', quantity: 1, price: 79.99 }],
    totalPrice: 79.99,
    orderDate: '2024-08-05',
  },
  {
    orderId: 'ORD-005',
    customerName: 'Eva Brown',
    products: [
      { name: 'Fitness Tracker', quantity: 1, price: 129.99 },
      { name: 'Water Bottle', quantity: 2, price: 14.99 },
    ],
    totalPrice: 159.97,
    orderDate: '2024-08-06',
  },
  {
    orderId: 'ORD-006',
    customerName: 'Frank Miller',
    products: [
      { name: 'Gaming Console', quantity: 1, price: 499.99 },
      { name: 'Controller', quantity: 2, price: 59.99 },
    ],
    totalPrice: 619.97,
    orderDate: '2024-08-07',
  },
  {
    orderId: 'ORD-007',
    customerName: 'Grace Lee',
    products: [{ name: 'Bluetooth Speaker', quantity: 1, price: 69.99 }],
    totalPrice: 69.99,
    orderDate: '2024-08-08',
  },
  {
    orderId: 'ORD-008',
    customerName: 'Henry Taylor',
    products: [
      { name: 'Smartwatch', quantity: 1, price: 199.99 },
      { name: 'Watch Band', quantity: 2, price: 24.99 },
    ],
    totalPrice: 249.97,
    orderDate: '2024-08-09',
  },
  {
    orderId: 'ORD-009',
    customerName: 'Isla Garcia',
    products: [
      { name: 'Tablet', quantity: 1, price: 349.99 },
      { name: 'Tablet Case', quantity: 1, price: 29.99 },
      { name: 'Stylus', quantity: 1, price: 39.99 },
    ],
    totalPrice: 419.97,
    orderDate: '2024-08-10',
  },
  {
    orderId: 'ORD-010',
    customerName: 'Jack Robinson',
    products: [{ name: 'Wireless Charger', quantity: 2, price: 34.99 }],
    totalPrice: 69.98,
    orderDate: '2024-08-11',
  },
];

main();
