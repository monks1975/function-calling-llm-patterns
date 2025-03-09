// ~/src/ReWOO/cli.ts

import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

import { format_state_as_markdown } from './helpers';
import { MemoryService } from './services/memory_service';
import { ReWOO } from './rewoo';

import { LlmTool } from './tools/llm.tool';
import { MemoryByKeywordTool } from './tools/memory_by_keyword.tool';
import { RecentMemoryTool } from './tools/recent_memory.tool';
import { SearchTool } from './tools/search.tool';

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
  const llm_tool = new LlmTool(ai_config);
  const search_tool = new SearchTool(process.env.TAVILY_API_KEY || '');
  const memory_by_keyword_tool = new MemoryByKeywordTool(ai_embedding_config);
  const recent_memory_tool = new RecentMemoryTool();

  const memory_service = new MemoryService(ai_embedding_config);

  // Create ReWOO instance
  const rewoo = new ReWOO(
    ai_config,
    [llm_tool, search_tool, memory_by_keyword_tool, recent_memory_tool],
    {
      onPlan: (state) => {
        console.log('\n🔍 Plan created:');
        // if (state.steps) {
        //   state.steps.forEach((step, index) => {
        //     console.log(`  ${index + 1}. ${step.plan}`);
        //     console.log(`     Tool: ${step.tool}[${step.args}]`);
        //   });
        // }
      },
      onToolExecute: (step, result) => {
        console.log(`\n🔧 Executing step: ${step.variable}`);
        console.log(`   Plan: ${step.plan}`);
        console.log(`   Tool: ${step.tool}[${step.args}]`);
      },
      onSolve: async (state) => {
        console.log('\n✅ Solution found');

        // Log session state as markdown
        const log_dir = path.join(__dirname, 'logs');
        const log_file = path.join(log_dir, `${rewoo.session_id}_log.md`);
        const markdown = format_state_as_markdown(state);
        await fs.promises.writeFile(log_file, markdown);
        console.log(`📝 Session logged to: ${log_file}`);
      },
      onError: (error) => console.error('\n❌ Error:', error.message),
    }
  );

  console.log('🚀 ReWOO CLI Started - Enter a task or type "q" to quit');
  console.log(`📌 Session ID: ${rewoo.session_id}`);

  function prompt_user() {
    rl.question('\n📝 Enter your task: ', async (task) => {
      if (task.toLowerCase() === 'q') {
        await memory_service.cleanup();
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
    process.exit(0);
  });
}

if (require.main === module) {
  create_cli();
}

export { create_cli };
