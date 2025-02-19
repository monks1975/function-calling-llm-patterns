// ~/src/ReACT/react-agent.ts

import { red, green, inverse } from 'ansis';
import * as path from 'path';

import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  convert_tools_for_prompt,
  create_tools_from_config,
  get_examples_for_tools,
} from './tools/repository';

import Handlebars from 'handlebars';
import { load_and_convert_yaml } from './helpers';
import OpenAI from 'openai';

import type { ToolDefinition, ToolsConfig } from './tools/repository';
import type { ToolResponse } from './tools/helpers';

interface ReActResponse {
  thought: string;
  action?: string;
  input?: any;
  observation?: string;
  final_answer?: string;
}

export class ReActAgent {
  private openai: OpenAI;
  private tools: Map<string, ToolDefinition>;
  private messages: ChatCompletionMessageParam[];
  private max_iterations: number;
  private base_few_shot_examples: string;

  constructor(openai: OpenAI, tools_config: ToolsConfig) {
    this.openai = openai;
    this.tools = new Map();
    this.max_iterations = 10;

    this.base_few_shot_examples = load_and_convert_yaml(
      path.join(__dirname, 'react.examples.yaml')
    );

    // Initialize tools from configuration
    const available_tools = create_tools_from_config(tools_config);

    // Store tools by their primary name only
    available_tools.forEach((tool) => {
      this.tools.set(tool.name.toLowerCase(), tool);
    });

    // Get tool-specific examples
    const tool_examples = get_examples_for_tools(tools_config);

    // Convert tools to a format suitable for the prompt
    const tools_for_prompt = convert_tools_for_prompt(available_tools);

    const system_template = Handlebars.compile(
      `
You are a ReAct agent that thinks step by step to solve problems.
You have access to a set of tools that are specific to the user's needs.

AVAILABLE TOOLS:

{{{tools_for_prompt}}}

You will respond in JSON format matching exactly the format shown in these examples.
Note that <user> and <assistant> tags are not part of the JSON response:

{{{base_few_shot_examples}}}

{{#if tool_examples}}
Tool-specific examples:

{{{tool_examples}}}

{{/if}}
Each response must be valid JSON and contain at least a "thought" field.
Include "action" and "input" fields when you need to use a tool.
Only include a "final_answer" field when you have reached the solution.
Never include an "observation" field - that will always come from a tool.
      `.trim()
    );

    const system_content = system_template({
      tools_for_prompt,
      base_few_shot_examples: this.base_few_shot_examples,
      tool_examples,
    });

    // console.log(system_content);

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
      const available_tools = Array.from(this.tools.values())
        .map((t) => t.name)
        .join(', ');

      throw new Error(
        `Tool '${action}' not found. Available tools are: ${available_tools}`
      );
    }

    try {
      // Parse the input if it's a string (handles JSON string inputs)
      const parsed_input =
        typeof input === 'string' ? JSON.parse(input) : input;

      if (!parsed_input) {
        throw new Error('Tool input cannot be null or undefined');
      }

      const response = (await tool.execute(parsed_input)) as ToolResponse;

      // Add defensive check for response object
      if (!response) {
        return 'Tool execution returned no response';
      }

      return (
        response.result ||
        response.error ||
        'Tool execution returned no response'
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON input for tool: ${error.message}`);
      }
      throw error;
    }
  }

  private get_context_messages(): ChatCompletionMessageParam[] {
    const systemMessage = this.messages[0]; // system
    const recentMessages = this.messages.slice(1).slice(-5); // last 5 messages
    return [systemMessage, ...recentMessages];
  }

  async answer(question: string) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    this.messages.push({ role: 'user', content: question });
    let iterations = 0;

    while (iterations < this.max_iterations) {
      iterations++;

      // Get next step from LLM using truncated context
      const stream = await this.openai.chat.completions.create({
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: this.get_context_messages(),
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

        // If we have a final answer, we're done
        if (response.final_answer) {
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
