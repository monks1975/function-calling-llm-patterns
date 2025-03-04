// ~/src/PlanExecute/main.ts

import dotenv from 'dotenv';
import { inspect } from 'util';

import { Planner, Worker, Solver, ReWOO } from './rewoo.agent';

import { calculator } from './tools/calculator.tool';
import { llm } from './tools/llm.tool';
import { google } from './tools/google.tool';
import { wikipedia } from './tools/wikipedia.tool';
import { DefaultToolRegistry } from './tool.registry';

dotenv.config();

// Basic AI configuration
const ai_config = {
  api_key: process.env.CEREBRAS_API_KEY || '',
  base_url: 'https://api.cerebras.ai/v1',
  model: 'llama3.3-70b',
  temperature: 0.5,
  max_completion_tokens: 1024,
};

async function main() {
  try {
    // Set up tools and registry
    const tools = { calculator, google, llm, wikipedia };
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
    console.log('\n=== Starting Pipeline ===');
    console.log('Query:', query, '\n');

    // Process the query
    const solution = await rewoo.process(query);

    // Log final results
    console.log('\n=== Pipeline Complete ===');
    console.log('Solution:', inspect(solution, { depth: null, colors: true }));
    // console.log(
    //   '\nFull state:',
    //   inspect(rewoo.get_state(), { depth: null, colors: true })
    // );
  } catch (error) {
    console.error('\n=== Pipeline Error ===');
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error)
    );

    // Log stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
