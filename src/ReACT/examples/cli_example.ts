#!/usr/bin/env node
// Example CLI application using the AgentSingleton
// To use this example, you'll need to install the following packages:
// npm install commander dotenv

import { Command } from 'commander'; // You may need to install this package with: npm install commander
import { AgentSingleton } from './agent_singleton';
import type { AiConfig } from './ai';
import type { ToolsConfig } from './tools/setup';
import * as dotenv from 'dotenv'; // You may need to install this package with: npm install dotenv

// Load environment variables
dotenv.config();

// Configuration for the agent
const aiConfig: AiConfig = {
  api_key: process.env.OPENAI_API_KEY || '',
  model: process.env.MODEL_NAME || 'gpt-4',
  // Add other configuration as needed
};

// Tool configuration
const toolsConfig: ToolsConfig = {
  // Configure your tools here
};

// Initialize the agent singleton at application startup
AgentSingleton.initialize(aiConfig, toolsConfig);

// Create CLI program
const program = new Command();

program
  .name('react-cli')
  .description('CLI tool using ReAct agent')
  .version('1.0.0');

// Define option types
interface AskOptions {
  new?: boolean;
}

// Command to ask a question
program
  .command('ask')
  .description('Ask a question to the agent')
  .argument('<question>', 'The question to ask')
  .option('-n, --new', 'Force creation of a new agent instance')
  .action(async (question: string, options: AskOptions) => {
    try {
      // Get the agent (optionally force a new instance)
      const agent = AgentSingleton.getAgent(options.new);

      // Set up event listeners for this command
      agent.on('chunk', (chunk) => {
        process.stdout.write('.');
      });

      agent.on('tool-observation', (observation) => {
        console.log('\nTool observation:', observation.data);
      });

      console.log('Thinking...');

      // Process the question
      const answer = await agent.answer(question);

      console.log('\nAnswer:', answer);
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Command to reset the agent
program
  .command('reset')
  .description('Reset the agent singleton')
  .action(() => {
    AgentSingleton.reset();
    console.log('Agent reset complete');
  });

// Command to handle content moderation example
program
  .command('moderate')
  .description('Ask a question with content moderation')
  .argument('<question>', 'The question to ask')
  .action(async (question: string) => {
    try {
      // Get the agent
      const agent = AgentSingleton.getAgent();

      // Set up content moderation listener
      let contentFlagged = false;

      agent.on('content-moderation', (data) => {
        contentFlagged = true;
        console.log('\nContent moderation triggered:');
        console.log('- Categories:', data.violated_categories.join(', '));
      });

      console.log('Thinking...');

      // Process the question
      const answer = await agent.answer(question);

      console.log('\nAnswer:', answer);

      if (contentFlagged) {
        console.log(
          '\nNote: Content moderation was triggered during this request.'
        );
      }
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/**
 * IMPORTANT NOTES:
 *
 * 1. The singleton is initialized once at application startup
 * 2. Each command uses the same agent instance by default
 * 3. The 'ask' command has an option to force a new instance if needed
 * 4. Process exit handlers ensure cleanup happens even on errors
 * 5. The 'reset' command allows explicit cleanup and reinitialization
 *
 * This pattern is suitable for CLI applications because:
 * - It minimizes the overhead of creating new agent instances
 * - It ensures proper cleanup on process exit
 * - It provides flexibility to reset or create new instances when needed
 */
