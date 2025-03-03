// ~/src/PlanExecute/main.ts

import dotenv from 'dotenv';
import { inspect } from 'util';

import { Planner, Worker, Solver, ReWOO } from './rewoo.agent';

import { calculator } from './tools/calculator.tool';
import { llm } from './tools/llm.tool';
import { google } from './tools/google.tool';
import { DefaultToolRegistry } from './tool.registry';

dotenv.config();

// Basic AI configuration
const ai_config = {
  api_key: process.env.TOGETHER_API_KEY || '',
  base_url: 'https://api.together.xyz/v1',
  model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  temperature: 0.5,
};

async function main() {
  try {
    // Set up tools and registry
    const tools = { calculator, google, llm };
    const tool_registry = new DefaultToolRegistry();
    Object.values(tools).forEach((tool) => tool_registry.register(tool));

    // Set up components
    const planner = new Planner(ai_config, tool_registry);

    // Set up worker with tools
    const worker = new Worker({
      tools,
      max_execution_time_ms: 5000,
    });

    const solver = new Solver(ai_config);

    // Create ReWOO instance
    const rewoo = new ReWOO(planner, worker, solver);

    // Test query that uses calculator
    const query = `Hello, how are you?`;
    console.log('Processing query:', query);

    // Process the query
    const solution = await rewoo.process(query);

    // Log results
    console.log(
      '\nSolution:',
      inspect(solution, { depth: null, colors: true })
    );
    console.log(
      '\nFull state:',
      inspect(rewoo.get_state(), { depth: null, colors: true })
    );
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
