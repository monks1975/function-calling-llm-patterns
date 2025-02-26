// ~/src/ReACT/react-agent.ts
// ReAct agent implementation

import { EventEmitter } from 'events';
import { z } from 'zod';
import * as path from 'path';
import Handlebars from 'handlebars';

import { AiGenerate, type AiEvents } from './ai';

import {
  content_violation,
  instructions,
  reached_max_iterations,
} from './react.instructions';

import { load_and_convert_yaml } from './helpers';
import { react_response_schema } from './react.schema';

import {
  get_tool_examples,
  get_tools_for_prompt,
  init_tools_from_config,
} from './tools/setup';

import type { AiConfig } from './ai';

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { ModerationResult } from './moderation';
import type { ToolDefinition, ToolsConfig } from './tools/setup';
import type { ToolResponse } from './tools/helpers';

type ReActResponse = z.infer<typeof react_response_schema>;

// Define ReActEvents interface that extends AiEvents
export interface ReActEvents extends AiEvents {
  chunk: (chunk: string) => void;
  toolObservation: (observation: { data: string; is_error: boolean }) => void;
  finalAnswer: (answer: string) => void;
  iteration: (count: number) => void;
  error: (error: Error) => void;
  contentModeration: (moderation_data: {
    original_message: string;
    moderation_result: ModerationResult;
    violated_categories: string[];
  }) => void;
}

export class ReActAgent extends AiGenerate {
  // Map of tool names to their implementations
  private tools: Map<string, ToolDefinition>;

  // Maps alternative tool names to their primary names
  private tool_name_map: Map<string, string>;

  // Maximum number of thought/action cycles
  private max_iterations: number;

  // Event emitter for ReAct-specific events
  private react_emitter: EventEmitter;

  // Stores the original user question
  private original_question: string | null;

  constructor(
    config: AiConfig,
    tools_config: ToolsConfig,
    max_iterations: number = 5
  ) {
    super(config);

    this.tools = new Map();
    this.tool_name_map = new Map();
    this.max_iterations = max_iterations;
    this.react_emitter = new EventEmitter();
    this.react_emitter.setMaxListeners(20);
    this.original_question = null;

    // Load base few shot examples
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

    const system_instructions = Handlebars.compile(instructions)({
      base_few_shot: base_few_shot,
      tools: tools_description,
      tools_few_shot: tools_few_shot,
      max_iterations: this.max_iterations,
    });

    this.add_message({
      role: 'system',
      content: system_instructions,
    });

    // Set up event forwarding from parent class
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from parent AiGenerate class to ReActAgent
   * This ensures events emitted by the parent class are also emitted by this class
   */
  private setupEventForwarding(): void {
    // Forward retry events
    super.on('retry', (notification) => {
      this.react_emitter.emit('retry', notification);
    });

    // Forward completion events
    super.on('completion', (completion) => {
      this.react_emitter.emit('completion', completion);
    });
  }

  /**
   * Register an event listener
   * @param event The event to listen for
   * @param listener The callback function
   */
  public override on<K extends keyof ReActEvents>(
    event: K,
    listener: ReActEvents[K]
  ): this {
    this.react_emitter.on(event, listener);
    return this;
  }

  /**
   * Remove an event listener
   * @param event The event to stop listening for
   * @param listener The callback function to remove
   */
  public override off<K extends keyof ReActEvents>(
    event: K,
    listener: ReActEvents[K]
  ): this {
    this.react_emitter.off(event, listener);
    return this;
  }

  /**
   * Removes all event listeners to prevent memory leaks
   * Should be called when the agent is no longer needed
   */
  public override cleanup(): void {
    // Abort any pending operations
    this.abort();

    // Remove all listeners from react_emitter
    this.react_emitter.removeAllListeners();

    // Call parent class cleanup to ensure complete resource release
    super.cleanup();

    // Clear tool references to help garbage collection
    this.tools.clear();
    this.tool_name_map.clear();

    // Log cleanup for debugging purposes
    console.log('ReActAgent cleanup completed');
  }

  // Executes a tool with the given input and returns the result
  // Handles input parsing, tool lookup, and error handling
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
        throw new Error('Tool execution returned no response');
      }

      // If the response contains an error, throw it
      if (response.error) {
        throw new Error(response.error);
      }

      // Return the result or a default message if no result
      return (
        response.result || 'Tool execution completed but returned no result'
      );
    } catch (error) {
      throw error;
    }
  }

  // Returns the relevant conversation context for the AI model
  // Includes the system prompt and the most recent conversation messages
  private get_context_messages(): ChatCompletionMessageParam[] {
    const systemMessage = this.get_messages()[0]; // system
    const recentMessages = this.get_messages().slice(1).slice(-5); // last 5 messages
    return [systemMessage, ...recentMessages];
  }

  // Handles content moderation for the last user message
  private async handle_moderation(
    messages: ChatCompletionMessageParam[]
  ): Promise<ChatCompletionMessageParam[]> {
    // If no moderator is configured or no messages, return original messages
    if (!this.config.moderator || messages.length === 0) {
      return messages;
    }

    const last_message = messages[messages.length - 1];

    if (
      last_message.role !== 'user' ||
      typeof last_message.content !== 'string'
    ) {
      return messages;
    }

    const moderation_result = await this.config.moderator.moderate(
      last_message.content
    );

    if (!moderation_result.flagged) {
      return messages;
    }

    // Emit content moderation event
    this.react_emitter.emit('contentModeration', {
      original_message: last_message.content,
      moderation_result,
      violated_categories: Object.entries(moderation_result.categories)
        .filter(([_, violated]) => violated)
        .map(([category, _]) => category),
    });

    const violated_categories = Object.entries(moderation_result.categories)
      .filter(([_, violated]) => violated)
      .map(([category, _]) => category);

    // Create a tool observation message about the content warning
    const tool_observation = Handlebars.compile(content_violation)({
      violated_categories: violated_categories.join(', '),
      safeguarding_message: this.config.moderation_config?.safeguarding_message,
    });

    // Replace the user's message with the tool observation
    return [
      ...messages.slice(0, -1),
      {
        role: 'user',
        content: tool_observation,
      },
    ];
  }

  // Handles the case when the agent reaches maximum iterations without finding
  // an answer.
  // Generates a helpful error message including recent thoughts and the
  // original question
  private async handle_max_iterations_reached() {
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

    const max_iterations_message = Handlebars.compile(reached_max_iterations)({
      max_iterations: this.max_iterations,
      original_question: this.original_question,
      recent_thoughts: recent_thoughts,
    });

    this.react_emitter.emit('toolObservation', {
      data: max_iterations_message,
      is_error: true,
    });

    this.add_message({
      role: 'user',
      content: max_iterations_message,
    });
  }

  // Override the get_model_response method to include moderation handling
  private async get_model_response(): Promise<string> {
    try {
      // Get context messages and apply moderation if needed
      const context_messages = this.get_context_messages();
      const moderated_messages = await this.handle_moderation(context_messages);

      // Call the parent class's get_completion method with the possibly moderated messages
      const response = await super.get_completion(moderated_messages, {
        type: 'json_object',
      });

      // Emit chunk event for streaming
      this.react_emitter.emit('chunk', response);
      return response;
    } catch (error) {
      this.react_emitter.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // Parses and validates the AI model's response to ensure it matches the
  // expected ReAct format
  // Throws detailed errors if the response is invalid
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
  // Handles JSON parsing errors, schema validation errors, and general errors
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
    return error instanceof Error ? error.message : String(error);
  }

  // Main method to process a user's question using the ReAct approach
  // Manages the thought/action cycle, tool execution, and response generation
  // Returns the final answer or an error message if max iterations are reached
  async answer(question: string) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    try {
      this.original_question = question;

      this.add_message({ role: 'user', content: question });

      let iterations = 0;

      while (iterations < this.max_iterations) {
        iterations++;

        this.react_emitter.emit('iteration', iterations);

        if (iterations === this.max_iterations) {
          await this.handle_max_iterations_reached();
        }

        try {
          const response_text = await this.get_model_response();
          const parsed_response = this.parse_react_response(response_text);

          this.add_message({
            role: 'assistant',
            content: response_text,
          });

          if (
            iterations === this.max_iterations &&
            !parsed_response.final_answer
          ) {
            const forced_answer = `I apologize, but I must stop here as I've reached the maximum allowed iterations and have not yet reached a final answer. Please try again with a differently worded question.`;
            this.react_emitter.emit('finalAnswer', forced_answer);
            return forced_answer;
          }

          if (parsed_response.final_answer) {
            this.react_emitter.emit(
              'finalAnswer',
              parsed_response.final_answer
            );
            return parsed_response.final_answer;
          }

          if (parsed_response.action && parsed_response.input !== undefined) {
            const observation = await this.execute_action(
              parsed_response.action,
              parsed_response.input
            );

            // Emit tool observation event
            this.react_emitter.emit('toolObservation', {
              data: observation,
              is_error: false,
            });

            this.add_message({
              role: 'user',
              content: `[Tool Observation] ${observation}`,
            });
          }
        } catch (error) {
          const error_observation = this.handle_error(error);

          // Emit tool observation error event
          this.react_emitter.emit('toolObservation', {
            data: `Error: ${error_observation}`,
            is_error: true,
          });

          this.add_message({
            role: 'user',
            content: `[Tool Observation] Error: ${error_observation}`,
          });
        }
      }

      return 'Error: Maximum iterations reached unexpectedly';
    } catch (error) {
      throw error;
    }
  }
}
