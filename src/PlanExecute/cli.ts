#!/usr/bin/env node

import readline from 'readline';
import { PlanningAgent } from './planning.agent';
import { AiConfig } from './ai';
import * as dotenv from 'dotenv';

dotenv.config();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Get API key from environment or prompt user
const getApiKey = (): Promise<string> => {
  const apiKey = process.env.TOGETHER_API_KEY;

  if (apiKey) {
    return Promise.resolve(apiKey);
  }

  return new Promise((resolve) => {
    rl.question('Enter your OpenAI API key: ', (answer) => {
      resolve(answer.trim());
    });
  });
};

// Main function to run the CLI
async function main() {
  try {
    console.log('Plan-Execute CLI');
    console.log('----------------');

    const apiKey = await getApiKey();

    // Configure the planning agent
    const config: AiConfig = {
      api_key: apiKey,
      base_url: 'https://api.together.xyz/v1',
      model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      temperature: 0.7,
      max_tokens: 2048,
    };

    const planningAgent = new PlanningAgent(config);

    // Main interaction loop
    const askForGoal = async () => {
      rl.question('\nEnter your goal (or type "q" to quit): ', async (goal) => {
        if (goal.toLowerCase() === 'q') {
          console.log('Goodbye!');
          rl.close();
          return;
        }

        try {
          console.log('\nGenerating plan...');
          const plan = await planningAgent.create_plan(goal);

          // Display the plan
          console.log(`\n📋 PLAN: ${plan.title}`);
          console.log('----------------');

          plan.steps.forEach((step) => {
            console.log(`Step ${step.id}: ${step.description}`);
            if (step.tool) {
              console.log(`   Tool: ${step.tool}`);
            }
            console.log('');
          });

          console.log(`Goal: ${plan.goal}`);

          // Ask for another goal
          askForGoal();
        } catch (error) {
          console.error('Error generating plan:', error);
          askForGoal();
        }
      });
    };

    askForGoal();
  } catch (error) {
    console.error('An error occurred:', error);
    rl.close();
    process.exit(1);
  }
}

// Start the CLI
main();
