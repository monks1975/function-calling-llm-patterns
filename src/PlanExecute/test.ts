// ~/src/PlanExecute/test.ts

import { PlanningAgent } from './planning.agent';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function run_test() {
  // Create a planning agent
  const planning_agent = new PlanningAgent({
    api_key: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4-turbo',
  });

  try {
    // Test with a simple goal
    const plan = await planning_agent.create_plan(
      'Find information about the latest AI research'
    );

    // Print the plan
    console.log('Generated Plan:');
    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
run_test();
