// ~/src/ReACT/react-agent.ts

import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { convert_tools_for_prompt } from './tools/repository';
import { get_tools_by_names } from './tools/repository';
import { load_and_convert_yaml } from './helpers';
import { red, green, inverse } from 'ansis';
import * as path from 'path';
import OpenAI from 'openai';

import type { Tool } from './tools/repository';

interface ReActResponse {
  thought?: string;
  action?: string;
  input?: any;
  observation?: string;
  final_answer?: string;
}

interface ToolFunction {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
}

export class ReActAgent {
  private openai: OpenAI;
  private tools: Map<string, Tool>;
  private messages: ChatCompletionMessageParam[];
  private max_iterations: number;
  private base_few_shot_examples: string;
  constructor(openai: OpenAI) {
    this.openai = openai;
    this.tools = new Map();
    this.max_iterations = 10;

    this.base_few_shot_examples = load_and_convert_yaml(
      path.join(__dirname, 'base-few-shot.yaml')
    );

    // Initialize with calculator and search tools
    const available_tools = get_tools_by_names(['calculator', 'search_web']);

    available_tools.forEach((tool) => {
      this.tools.set(tool.name.toLowerCase(), tool);
    });

    // Convert tools to a format suitable for the prompt
    const tools_for_prompt = convert_tools_for_prompt(available_tools);

    const system_content =
      'You are a ReAct agent that thinks step by step to solve problems.\n\n' +
      'You will respond in JSON format matching exactly the format shown in these examples.\n' +
      'Note that <user> and <assistant> tags are not part of the JSON response:\n\n' +
      this.base_few_shot_examples +
      '\n\n' +
      'Available Tools:\n\n' +
      tools_for_prompt +
      '\n\n' +
      'Each response must be valid JSON and contain at least a "thought" field.\n' +
      'Include "action" and "input" fields when you need to use a tool.\n' +
      'Only include a "final_answer" field when you have reached the solution.\n' +
      'Never include an "observation" field - that will always come from a tool.';

    this.messages = [
      {
        role: 'system',
        content: system_content,
      },
    ];
  }

  private async execute_action(action: string, input: any): Promise<string> {
    if (!action || typeof action !== 'string') {
      throw new Error('Invalid action: action must be a non-empty string');
    }

    const tool = this.tools.get(action.toLowerCase());
    if (!tool) {
      throw new Error(
        `Tool '${action}' not found. Available tools are: ${Array.from(
          this.tools.keys()
        ).join(', ')}`
      );
    }

    // Parse the input if it's a string (handles JSON string inputs)
    const parsed_input = typeof input === 'string' ? JSON.parse(input) : input;
    const result = await tool.function(parsed_input);
    return result.results || result.error || 'No result returned from tool';
  }

  async answer(question: string) {
    this.messages.push({ role: 'user', content: question });
    let iterations = 0;

    while (iterations < this.max_iterations) {
      iterations++;

      // Get next step from LLM
      const stream = await this.openai.chat.completions.create({
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: this.messages,
        stream: true,
      });

      let response_text = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        response_text += content;
        // Stream the thought process to console
        process.stdout.write(content);
      }

      try {
        const response: ReActResponse = JSON.parse(response_text);

        // Log the thought process
        // if (response.thought) {
        //   //console.log('\nThought:', response.thought);
        // }

        // If we have a final answer, we're done
        if (response.final_answer) {
          //console.log('\nFinal Answer:', response.final_answer);
          return response.final_answer;
        }

        // Execute action if specified
        if (response.action && response.input) {
          const observation = await this.execute_action(
            response.action,
            response.input
          );
          log_to_console('info', '[Tool Observation]', observation);

          // Add the observation to the message history
          this.messages.push({
            role: 'assistant',
            content: response_text,
          });

          this.messages.push({
            role: 'user',
            content: `[Tool Observation] ${observation}`,
          });
        }
      } catch (error) {
        let error_observation: string;

        if (error instanceof SyntaxError) {
          error_observation = `Error: Invalid JSON response from model. Response was: "${response_text}". Response must be valid JSON containing at least a "thought" field. Example valid response: { "thought": "thinking about the problem", "final_answer": "the answer" }`;
        } else {
          error_observation = `Error: Unexpected error occurred: ${error}`;
        }

        log_to_console('error', '[Tool Observation]', error_observation);

        // Feed the error back to the model as an observation
        this.messages.push({
          role: 'assistant',
          content: response_text,
        });

        this.messages.push({
          role: 'user',
          content: `[Tool Observation] ${error_observation}`,
        });

        // Continue the loop to let the model try again
        continue;
      }
    }

    return 'Error: Maximum iterations reached';
  }
}

function log_to_console(type: 'info' | 'error', tag: string, message: string) {
  if (type === 'info') {
    console.log(green`\n\n${inverse`${tag}`} ${message}\n`);
  } else {
    console.log(red`\n\n${inverse`${tag}`} ${message}\n`);
  }
}
