// ~/src/ReACT/react-agent.ts

import { red, green, inverse } from 'ansis';
import { z } from 'zod';
import * as path from 'path';
import Handlebars from 'handlebars';
import OpenAI from 'openai';

import { load_and_convert_yaml } from './helpers';
import { react_response_schema } from './react.schema';
import { SYSTEM_INSTRUCTIONS } from './react.instructions';

import {
  get_tool_examples,
  get_tools_for_prompt,
  init_tools_from_config,
} from './tools/setup';

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ToolDefinition, ToolsConfig } from './tools/setup';
import type { ToolResponse } from './tools/helpers';

type ReActResponse = z.infer<typeof react_response_schema>;

export class ReActAgent {
  private openai: OpenAI;
  private tools: Map<string, ToolDefinition>;
  private tool_name_map: Map<string, string>;
  private messages: ChatCompletionMessageParam[];
  private max_iterations: number;

  constructor(
    openai: OpenAI,
    tools_config: ToolsConfig,
    max_iterations: number = 15
  ) {
    this.openai = openai;
    this.tools = new Map();
    this.tool_name_map = new Map();
    this.max_iterations = max_iterations;

    const base_few_shot = load_and_convert_yaml(
      path.join(__dirname, 'react.examples.yaml')
    );

    // Initialize tools from configuration
    const available_tools = init_tools_from_config(tools_config);

    // Store tools by their primary name and build alternative name mapping
    available_tools.forEach((tool) => {
      const primary_name = tool.name.toLowerCase();
      this.tools.set(primary_name, tool);

      // Add mapping for the primary name itself
      this.tool_name_map.set(primary_name, primary_name);

      // Add mappings for alternative names if they exist
      if (tool.alternative_names) {
        tool.alternative_names.forEach((alt_name) => {
          this.tool_name_map.set(alt_name.toLowerCase(), primary_name);
        });
      }
    });

    const tools_few_shot = get_tool_examples(tools_config);
    const tools_description = get_tools_for_prompt(available_tools);
    const system_instructions = Handlebars.compile(SYSTEM_INSTRUCTIONS);

    const interpolated_system_instructions = system_instructions({
      base_few_shot: base_few_shot,
      tools: tools_description,
      tools_few_shot: tools_few_shot,
      max_iterations: this.max_iterations,
    });

    this.messages = [
      {
        role: 'system',
        content: interpolated_system_instructions,
      },
    ];
  }

  private async execute_action(action: string, input: any): Promise<string> {
    if (!action || typeof action !== 'string') {
      throw new Error('Invalid action: action must be a non-empty string');
    }

    const normalized_action = action.toLowerCase();
    const primary_name = this.tool_name_map.get(normalized_action);
    const tool = primary_name ? this.tools.get(primary_name) : null;

    if (!tool) {
      const available_tools = Array.from(this.tools.values())
        .map((t) => t.name)
        .join(', ');

      throw new Error(
        `Tool '${action}' not found. Available tools are: ${available_tools}`
      );
    }

    try {
      // Parse the input if it's a string
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

      // When we've hit max iterations, add a prompt to wrap up
      if (iterations === this.max_iterations) {
        this.messages.push({
          role: 'user',
          content: `You have reached the maximum number of iterations (${this.max_iterations}). Please provide a final_answer explaining that you couldn't complete the task and briefly explain why.`,
        });
      }

      // Get next step from LLM using truncated context
      const stream = await this.openai.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        messages: this.get_context_messages(),
        stream: true,
        max_tokens: 8192,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      let response_text = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        response_text += content;
        // Stream the thought process to console
        process.stdout.write(content);
      }

      try {
        // Add pre-parsing validation
        if (!response_text.trim()) {
          throw new Error('Empty response from model');
        }

        // First ensure we have the canonical object form before validation
        const prepare_react_response = (response: unknown): unknown => {
          if (typeof response === 'string') {
            try {
              return JSON.parse(response);
            } catch (e) {
              throw new SyntaxError(`Invalid JSON: ${response}`);
            }
          }
          return response;
        };

        let parsed_json = prepare_react_response(response_text);

        const parsed_response: ReActResponse =
          react_response_schema.parse(parsed_json);

        // Add the assistant's response to history before executing action
        this.messages.push({
          role: 'assistant',
          content: response_text,
        });

        if (parsed_response.final_answer) {
          return parsed_response.final_answer;
        }

        // Execute action if specified
        if (parsed_response.action && parsed_response.input !== undefined) {
          const observation = await this.execute_action(
            parsed_response.action,
            parsed_response.input
          );

          log_to_console('info', '[Tool Observation]', observation);

          this.messages.push({
            role: 'user',
            content: `[Tool Observation] ${observation}`,
          });
        }
      } catch (error) {
        let error_observation: string;

        if (error instanceof SyntaxError) {
          error_observation = `Error: Invalid JSON response from model. Response was: "${response_text}". Response must be valid JSON containing at least a "thought" field. Example valid response: { "thought": "thinking about the problem", "final_answer": "the answer" }`;
        } else if (error instanceof z.ZodError) {
          error_observation = `Error: Invalid response structure: ${error.errors
            .map((e) => e.message)
            .join(', ')}`;
        } else {
          error_observation = `Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
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

      // When max iterations is reached, return the context of what happened
      if (iterations === this.max_iterations) {
        const history = this.messages
          .filter((m) => m.role === 'assistant')
          .map((m) => {
            try {
              const parsed = JSON.parse(m.content as string);
              return parsed.thought;
            } catch {
              return m.content;
            }
          })
          .slice(-3)
          .join('\n');

        return `Error: Maximum iterations (${this.max_iterations}) reached. Recent thoughts:\n${history}\n\nConsider increasing max_iterations if the problem is complex or try rephrasing your question.`;
      }
    }

    return 'Error: Maximum iterations reached unexpectedly';
  }
}

function log_to_console(type: 'info' | 'error', tag: string, message: string) {
  if (type === 'info') {
    console.log(green`\n\n${inverse`${tag}`} ${message}\n`);
  } else {
    console.log(red`\n\n${inverse`${tag}`} ${message}\n`);
  }
}
