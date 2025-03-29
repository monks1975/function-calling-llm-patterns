// ~/src/ReACT/react.agent.ts
// ReAct agent implementation

import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import * as path from 'path';
import Handlebars from 'handlebars';

import { AiError, AiGenerate } from '../core/ai';

import {
  react_instruction_template,
  max_iterations_template,
} from './react.instructions';

import { load_and_convert_yaml } from './helpers';
import { react_response_schema } from './react.schema';

import {
  get_tool_examples,
  get_tools_for_prompt,
  init_tools_from_config,
} from './tools/setup';

import type { AiConfig } from '../core/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ToolsConfig } from './tools/setup';
import type { ToolResponse } from './tools/helpers';

import type {
  ReActResponse,
  ReActCallbacks,
  ReActState,
  ReActTokenUsage,
} from './types';

export class ReActAgent extends AiGenerate {
  private state: ReActState;

  constructor(
    ai_config: AiConfig,
    tools_config: ToolsConfig,
    max_iterations: number = 12
  ) {
    super(ai_config);

    // Initialize state
    this.state = {
      session_id: uuid(),
      task: '',
      timestamp: Date.now(),
      max_iterations,
      tools: new Map(),
      tool_name_map: new Map(),
      original_question: null,
      previous_actions: [],
      previous_thoughts: [],
    };

    // Load base few shot examples
    const base_few_shot = load_and_convert_yaml(
      path.join(__dirname, 'react.examples.yaml')
    );

    // Initialize tools from configuration
    const available_tools = init_tools_from_config(tools_config);

    // Store tools by their primary name and build alternative name mapping
    available_tools.forEach((tool) => {
      const primary_name = tool.name.toLowerCase();
      this.state.tools.set(primary_name, tool);

      // Add mapping for the primary name itself
      this.state.tool_name_map.set(primary_name, primary_name);

      // Add mappings for alternative names if they exist
      if (tool.alternative_names) {
        tool.alternative_names.forEach((alt_name) => {
          this.state.tool_name_map.set(alt_name.toLowerCase(), primary_name);
        });
      }
    });

    const tools_few_shot = get_tool_examples(tools_config);
    const tools_description = get_tools_for_prompt(available_tools);

    const system_instructions = Handlebars.compile(react_instruction_template)({
      base_few_shot: base_few_shot,
      tools: tools_description,
      tools_few_shot: tools_few_shot,
      max_iterations: this.state.max_iterations,
    });

    this.add_message({
      role: 'system',
      content: system_instructions,
    });
  }

  // Getters for state
  get session_id(): string {
    return this.state.session_id;
  }

  get current_state(): ReActState {
    return { ...this.state };
  }

  // Executes a tool with the given input and returns the result
  // Handles input parsing, tool lookup, and error handling
  private async execute_action(action: string, input: any): Promise<string> {
    if (!action || typeof action !== 'string') {
      throw new Error('Invalid action: action must be a non-empty string');
    }

    const normalized_action = action.toLowerCase();
    const primary_name = this.state.tool_name_map.get(normalized_action);
    const tool = primary_name ? this.state.tools.get(primary_name) : null;

    if (!tool) {
      const available_tools = Array.from(this.state.tools.values())
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
        throw new Error('Tool execution returned no response');
      }

      // If the response contains an error, throw it
      if (response.error) {
        throw new Error(response.error);
      }

      // Return the result or a default message if no result
      const result =
        response.result || 'Tool execution completed but returned no result';
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  // Returns the relevant conversation context for the AI model
  // Includes the system prompt and the most recent conversation messages
  private get_context_messages(): ChatCompletionMessageParam[] {
    const systemMessage = this.get_messages()[0]; // system
    const recentMessages = this.get_messages().slice(1).slice(-5); // last 5 messages
    return [systemMessage, ...recentMessages];
  }

  // Helper to track token usage
  private track_token_usage(usage: ReActTokenUsage): void {
    if (!this.state.token_usage) this.state.token_usage = [];
    this.state.token_usage.push(usage);
  }

  // Handles the case when the agent reaches maximum iterations without finding
  // an answer.
  private async handle_max_iterations_reached(callbacks?: ReActCallbacks) {
    const recent_thoughts = this.get_messages()
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

    const max_iterations_reached = Handlebars.compile(max_iterations_template)({
      max_iterations: this.state.max_iterations,
      original_question: this.state.original_question,
      recent_thoughts: recent_thoughts,
    });

    callbacks?.onToolObservation?.({
      data: max_iterations_reached,
      is_error: true,
    });

    // Add the message and mark it as a tool observation using the name field
    this.add_message({
      role: 'user',
      name: 'tool_observation',
      content: `[Tool Observation] ${max_iterations_reached}`,
    } as ChatCompletionMessageParam);
  }

  // Get model response with callbacks for notifications
  private async get_model_response(
    callbacks?: ReActCallbacks
  ): Promise<string> {
    try {
      // Get latest conversation messages
      const context_messages = this.get_context_messages();

      // Call the parent class's get_completion method with the possibly moderated messages
      const response = await super.get_completion(
        context_messages,
        { type: 'json_object' },
        {
          onRetry: callbacks?.onRetry,
          onCompletion: (completion) => {
            if (completion.usage) {
              this.track_token_usage({
                source: 'model_response',
                prompt_tokens: completion.usage.prompt_tokens,
                completion_tokens: completion.usage.completion_tokens,
                total_tokens: completion.usage.total_tokens,
              });
            }
            callbacks?.onCompletion?.(completion);
          },
        }
      );

      callbacks?.onChunk?.(response);
      return response;
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(typedError);
      throw typedError;
    }
  }

  // Parses and validates the AI model's response
  private parse_react_response(response_text: string): ReActResponse {
    if (!response_text.trim()) {
      throw new Error('Empty response from model');
    }

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

    const parsed_json = prepare_react_response(response_text);
    return react_response_schema.parse(parsed_json);
  }

  // Converts various error types into human-readable error messages
  private handle_error(error: unknown): string {
    if (error instanceof SyntaxError) {
      return 'Invalid JSON response from model. Response must be valid JSON containing at least a "thought" field. Example valid response: { "thought": "thinking about the problem", "final_answer": "the answer" }';
    }
    if (error instanceof z.ZodError) {
      return (
        'Invalid response structure: ' +
        error.errors.map((e) => e.message).join(', ')
      );
    }

    // Handle AiError with enhanced error details
    if (error instanceof AiError) {
      let errorMessage = error.message;

      // Add status code if available
      if (error.status) {
        errorMessage = `${error.status} status code - ${errorMessage}`;
      }

      // Add relevant headers if available
      if (error.headers) {
        const relevantHeaders = [
          'x-request-id',
          'openai-organization',
          'openai-processing-ms',
          'openai-version',
          'x-ratelimit-limit-requests',
          'x-ratelimit-remaining-requests',
          'x-ratelimit-reset-requests',
          'x-ratelimit-limit-tokens',
          'x-ratelimit-remaining-tokens',
          'x-ratelimit-reset-tokens',
        ];

        const headerInfo = relevantHeaders
          .filter((header) => error.headers && header in error.headers)
          .map((header) => `${header}: ${error.headers![header]}`)
          .join(', ');

        if (headerInfo) {
          errorMessage += ` (Headers: ${headerInfo})`;
        }
      }

      // Add error details if available
      if (error.errorDetails) {
        const detailsStr = Object.entries(error.errorDetails)
          .filter(([key, value]) => value && key !== 'message') // Skip message as it's already included
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');

        if (detailsStr) {
          errorMessage += ` (Details: ${detailsStr})`;
        }
      }

      return errorMessage;
    }

    return error instanceof Error ? error.message : String(error);
  }

  // Main method to process a user's question using the ReAct approach
  async answer(question: string, callbacks?: ReActCallbacks): Promise<string> {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    try {
      // Initialize state for new question
      this.state = {
        ...this.state,
        task: question,
        original_question: question,
        timestamp: Date.now(),
        previous_actions: [],
        previous_thoughts: [],
      };

      this.add_message({ role: 'user', content: question });

      let iterations = 0;

      while (iterations < this.state.max_iterations) {
        iterations++;
        callbacks?.onIteration?.(iterations);

        if (iterations === this.state.max_iterations) {
          await this.handle_max_iterations_reached(callbacks);
        }

        try {
          const response_text = await this.get_model_response(callbacks);
          const parsed_response = this.parse_react_response(response_text);

          if (parsed_response.thought) {
            this.state.previous_thoughts.push(parsed_response.thought);
          }

          this.add_message({
            role: 'assistant',
            content: response_text,
          });

          if (
            iterations === this.state.max_iterations &&
            !parsed_response.final_answer
          ) {
            const forced_answer = `I apologize, but I must stop here as I've reached the maximum allowed iterations and have not yet reached a final answer. Please try again with a differently worded question.`;
            callbacks?.onFinalAnswer?.(forced_answer);
            return forced_answer;
          }

          if (parsed_response.final_answer) {
            callbacks?.onFinalAnswer?.(parsed_response.final_answer);
            return parsed_response.final_answer;
          }

          if (parsed_response.action && parsed_response.input !== undefined) {
            const observation = await this.execute_action(
              parsed_response.action,
              parsed_response.input
            );

            callbacks?.onToolObservation?.({
              data: observation,
              is_error: false,
            });

            // Add the message and mark it as a tool observation using the name field
            this.add_message({
              role: 'user',
              name: 'tool_observation',
              content: `[Tool Observation] ${observation}`,
            } as ChatCompletionMessageParam);
          }
        } catch (error) {
          const error_observation = this.handle_error(error);

          callbacks?.onToolObservation?.({
            data: `Error: ${error_observation}`,
            is_error: true,
          });

          // Add the message and mark it as a tool observation using the name field
          this.add_message({
            role: 'user',
            name: 'tool_observation',
            content: `[Tool Observation] Error: ${error_observation}`,
          } as ChatCompletionMessageParam);
        }
      }

      return 'Error: Maximum iterations reached unexpectedly';
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.errors = [...(this.state.errors || []), err];
      throw err;
    }
  }

  public override cleanup(): void {
    // Abort any pending requests
    this.abort();

    // Clear tool references to help garbage collection
    this.state.tools.clear();
    this.state.tool_name_map.clear();

    // Clear history arrays
    this.state.previous_actions = [];
    this.state.previous_thoughts = [];

    // Call parent class cleanup
    super.cleanup();

    // Log cleanup for debugging purposes
    console.log('ReActAgent cleanup completed');
  }
}
