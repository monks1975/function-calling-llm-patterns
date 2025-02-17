// ~/src/REACT-COT/chat-stream.ts

import OpenAI from 'openai';
import { calculator_tool } from './tools/calculator';
import { search_web_tool } from './tools/search';
import { logger, logReactStep } from './logger';

import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import type { ToolResponse } from './tools/helpers';

interface ReActStep {
  thought?: string;
  action?: string;
  action_input?: any;
  observation?: string;
  final_answer?: string;
}

const log = {
  step: (step: ReActStep) => {
    logReactStep(step);
  },
  error: (message: string) => {
    console.error('❌ Error:', message);
    logger.error(message);
  },
  stream: (content: string) => process.stdout.write(content),
};

export class ChatStream {
  private messages: ChatCompletionMessageParam[] = [];
  private openai: OpenAI;
  private conversation_log: string = ''; // Track the accumulated conversation

  constructor(openai: OpenAI, system_prompt?: string) {
    this.openai = openai;
    if (system_prompt) {
      this.messages = [
        {
          role: 'system',
          content: system_prompt,
        },
      ];
    }
  }

  async process_user_input(user_input: string): Promise<void> {
    // Show user input in console and log it
    console.log('\nUser:', user_input);
    logger.info({ type: 'USER_INPUT', content: user_input });

    // Start fresh conversation log with user input
    this.conversation_log = `User: ${user_input}\n`;

    // Keep only system message and add new user message
    this.messages = this.messages.slice(0, 1);

    this.messages.push({
      role: 'user',
      content: this.conversation_log,
    });

    let iterations = 0;
    const max_iterations = 10;

    while (iterations < max_iterations) {
      // console.log(`\n🔄 Iteration ${iterations + 1}/${maxIterations}`); // debug logging

      const step = await this.execute_step();
      // log.step(step); // debug logging

      if (step.final_answer) {
        this.conversation_log += `Thought: ${step.thought}\nFinal Answer: ${step.final_answer}`;

        // Remove console.log here since it's handled by streaming
        logger.info({
          type: 'ASSISTANT_RESPONSE',
          thought: step.thought,
          response: step.final_answer,
        });

        // Update the user message with complete conversation
        this.messages[1] = {
          role: 'user',
          content: this.conversation_log,
        };

        // Add final assistant message
        this.messages.push({
          role: 'assistant',
          content: step.final_answer,
        });
        break;
      }

      // Only process action if it exists and is not empty
      if (step.action && step.action.trim()) {
        // Add the step to conversation log (without <HALT>)
        const step_text = `Thought: ${step.thought}\nAction: ${
          step.action
        }\nAction Input: ${JSON.stringify(step.action_input)}`;
        this.conversation_log += step_text + '\n';

        // Execute action and get observation
        const observation = await this.execute_action(
          step.action,
          step.action_input
        );
        // Remove or change to logger.debug if you want to keep this information
        // console.log('📊 Observation added:', observation.length > 256 ? observation.slice(0, 256) + '...' : observation);

        // Add observation to conversation log
        this.conversation_log += `Observation: ${observation}\n\n`;
      } else {
        // If there's no action but there is a thought, add only the thought to the log
        if (step.thought) {
          this.conversation_log += `Thought: ${step.thought}\n\n`;
        }
      }

      // Update the user message with accumulated conversation
      this.messages[1] = {
        role: 'user',
        content: this.conversation_log,
      };

      iterations++;
    }

    if (iterations >= max_iterations) {
      log.error('Max iterations reached without final answer');
      this.messages.push({
        role: 'assistant',
        content:
          'I apologize, but I was unable to reach a final answer within the allowed number of steps. Please try rephrasing your question or breaking it into smaller parts.',
      });
    }
  }

  private async execute_step(): Promise<ReActStep> {
    const stream = await this.openai.chat.completions.create({
      model: 'Qwen/Qwen2-VL-72B-Instruct',
      messages: this.messages,
      stream: true,
      stop: ['<HALT>'],
    });

    let content = '';
    let buffer = '';
    let isFinalAnswer = false;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      content += delta;
      buffer += delta;

      // Check if we've hit the Final Answer section
      if (buffer.includes('Final Answer:') && !isFinalAnswer) {
        isFinalAnswer = true;
        // Clear buffer up to Final Answer:
        buffer = buffer.substring(buffer.indexOf('Final Answer:'));
      }

      // If we're in final answer mode, stream to console
      if (isFinalAnswer) {
        process.stdout.write(delta);
      }
    }

    return this.parse_step_response(content);
  }

  private validate_action(action: string, action_input: any): boolean {
    if (!action || !action_input) return false;

    switch (action.toLowerCase()) {
      case 'calculator':
        return typeof action_input === 'object' && 'expression' in action_input;
      case 'search web':
        return typeof action_input === 'object' && 'query' in action_input;
      default:
        return false;
    }
  }

  private async execute_action(
    action: string,
    action_input: any
  ): Promise<string> {
    // Validate action and input first
    if (!this.validate_action(action, action_input)) {
      return `Invalid action or input. Action "${action}" requires specific input format.`;
    }

    let retry_count = 0;
    const max_retries = 3;
    const base_backoff_ms = 1000; // Start with 1 second

    while (retry_count <= max_retries) {
      try {
        let result: ToolResponse;
        switch (action.toLowerCase()) {
          case 'calculator':
            result = await calculator_tool(action_input);
            break;
          case 'search web':
            result = await search_web_tool(action_input);
            break;
          default:
            result = {
              error: `Invalid action: "${action}". Available actions: calculator, search web`,
            };
        }

        return result.results || result.error || 'No result';
      } catch (error: any) {
        if (
          error.message?.includes('DDG detected an anomaly') ||
          error.message?.includes('rate limit') ||
          error.message?.includes('too many requests')
        ) {
          retry_count++;
          if (retry_count <= max_retries) {
            const backoff_time = base_backoff_ms * Math.pow(2, retry_count - 1);
            // Change console.log to logger
            logger.info(
              `Rate limit hit. Retrying in ${backoff_time / 1000}s...`
            );
            await new Promise((resolve) => setTimeout(resolve, backoff_time));
            continue;
          }
        }
        return `Error executing action: ${error.message}`;
      }
    }

    return 'Failed to execute action after maximum retries';
  }

  private parse_step_response(content: string): ReActStep {
    const step: ReActStep = {};
    const valid_actions = ['calculator', 'search web'];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('Thought:')) {
        step.thought = line.replace('Thought:', '').trim();
      } else if (line.startsWith('Action:')) {
        const action_content = line.replace('Action:', '').trim();
        // Only set action if it's valid
        if (
          action_content &&
          valid_actions.includes(action_content.toLowerCase())
        ) {
          step.action = action_content;
        }
      } else if (line.startsWith('Action Input:')) {
        // Only try to parse action input if we have a valid action
        if (step.action) {
          try {
            const inputJson = line.replace('Action Input:', '').trim();
            step.action_input = JSON.parse(inputJson);
          } catch (e) {
            // If JSON parsing fails, invalidate the action and set observation
            console.error('Failed to parse action input:', e);
            step.action = undefined;
            step.action_input = undefined;
            step.observation = `Error: Invalid JSON in Action Input. Please provide valid JSON.`;
          }
        }
      } else if (line.startsWith('Final Answer:')) {
        step.final_answer = line.replace('Final Answer:', '').trim();
      }
    }

    return step;
  }

  // Getter for messages if needed
  getMessages(): ChatCompletionMessageParam[] {
    return this.messages;
  }
}
