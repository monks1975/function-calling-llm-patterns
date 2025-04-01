// ~/src/rewoo/cli.ts

import { Subscription } from 'rxjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { event_bus } from './events';
import { format_state_as_markdown } from './helpers';
import { MemoryService } from '../core/services';
import { ReWOO } from './rewoo';

import { CalculatorTool } from './tools/calculator.tool';
import { LibraryTool } from './tools/library.tool';
import { LlmTool } from './tools/llm.tool';
import { MemoryByKeywordTool } from './tools/memory_by_keyword.tool';
import { RecentMemoryTool } from './tools/recent_memory.tool';
import { TavilyTool } from './tools/tavily.tool';

dotenv.config();

function create_cli() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ai_config = {
    api_key: process.env.CEREBRAS_API_KEY || '',
    base_url: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    temperature: 0.5,
  };

  const ai_embedding_config = {
    api_key: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
  };

  // Initialize tools
  const llm_tool = new LlmTool(ai_config, event_bus);
  const tavily_tool = new TavilyTool(process.env.TAVILY_API_KEY || '');
  const memory_by_keyword_tool = new MemoryByKeywordTool(ai_embedding_config);
  const recent_memory_tool = new RecentMemoryTool();
  const calculator_tool = new CalculatorTool();

  const library_tool = new LibraryTool(
    'This library contains documents about Apple and Steve Jobs. You should use this tool to search for information when asked about Apple and Steve Jobs.',
    'be3fe717-64f1-4014-8b03-01c534aefd30'
  );

  const memory_service = new MemoryService(ai_embedding_config);
  const subscriptions = new Subscription();

  // Create ReWOO instance
  const rewoo = new ReWOO(ai_config, [
    library_tool,
    llm_tool,
    memory_by_keyword_tool,
    recent_memory_tool,
    tavily_tool,
  ]);

  // Subscribe to events
  subscriptions.add(
    event_bus.events.subscribe(async (event) => {
      switch (event.type) {
        case 'plan_created':
          console.log('\n🔍 Plan created:');
          if (event.plan.steps) {
            event.plan.steps.forEach((step, index) => {
              console.log(`  ${index + 1}. ${step.plan}`);
              console.log(`     Tool: ${step.tool}[${step.args}]`);
            });
          }
          break;

        case 'tool_start':
          console.log(`\n🔧 Starting tool: ${event.step.tool}`);
          console.log(`   Args: ${event.args}`);
          break;

        case 'tool_complete':
          console.log(`\n✅ Tool complete: ${event.step.tool}`);
          console.log(`   Result: ${event.result}`);
          break;

        case 'solution_found':
          console.log('\n✅ Solution found');
          // Log session state as markdown
          const log_dir = path.join(__dirname, 'logs');
          const log_file = path.join(log_dir, `${rewoo.session_id}_log.md`);
          const markdown = format_state_as_markdown(event.state);
          await fs.promises.writeFile(log_file, markdown);
          console.log(`📝 Session logged to: ${log_file}`);
          break;

        case 'completion':
          console.log(`\n🤖 ${event.source} completion received`);
          if (event.source) {
            console.log(`   Source: ${event.source}`);
          }
          if (event.completion.usage) {
            console.log('   Token Usage:');
            console.log(`     Prompt: ${event.completion.usage.prompt_tokens}`);
            console.log(
              `     Completion: ${event.completion.usage.completion_tokens}`
            );
            console.log(`     Total: ${event.completion.usage.total_tokens}`);
          }
          break;

        case 'error':
          console.error('\n❌ Error:', event.error.message);
          if (event.context) {
            console.error('   Context:', event.context);
          }
          if (event.step) {
            console.error('   Step:', event.step.tool);
          }
          break;

        case 'retry':
          console.log(
            `\n🔄 Retry attempt ${event.attempt} (backoff: ${event.backoff_ms}ms)`
          );
          console.error('   Error:', event.error.message);
          break;

        case 'info':
          console.log('\nℹ️ ', event.message);
          break;
      }
    })
  );

  console.log('🚀 ReWOO CLI Started - Enter a task or type "q" to quit');
  console.log(`📌 Session ID: ${rewoo.session_id}`);

  function prompt_user() {
    rl.question('\n📝 Enter your task: ', async (task) => {
      if (task.toLowerCase() === 'q') {
        await memory_service.cleanup();
        subscriptions.unsubscribe();
        rl.close();
        return;
      }

      // Skip empty tasks and re-prompt
      if (!task.trim()) {
        console.log('❌ Task cannot be empty. Please try again.');
        prompt_user();
        return;
      }

      try {
        console.log(`\n⏳ Processing task: "${task}"`);
        const result = await rewoo.process(task);

        console.log('\n📊 Result:');
        console.log(result.result);

        // Store the solution
        if (result.result) {
          await memory_service.store_solution(
            rewoo.session_id,
            task,
            result.result,
            {
              steps_count: result.steps?.length || 0,
              errors: result.errors?.length || 0,
            }
          );
        }

        prompt_user();
      } catch (error) {
        console.error('❌ Error:', error);
        prompt_user();
      }
    });
  }

  prompt_user();

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\nExiting...');
    await memory_service.cleanup();
    subscriptions.unsubscribe();
    process.exit(0);
  });
}

if (require.main === module) {
  create_cli();
}

export { create_cli };
