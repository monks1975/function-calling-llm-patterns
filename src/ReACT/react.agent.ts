// ~/src/ReACT/react.agent.ts
// ReAct agent implementation

import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import * as path from 'path';
import Handlebars from 'handlebars';

import { AiError, AiGenerate } from '../core/ai';
import { ReActMessageHandler } from './message.handler';
import { ReActToolExecutor } from './tool.executor';

import {
  ReActToolError,
  ReActResponseError,
  ReActIterationError,
} from './errors';

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
import type { ToolsConfig } from './tools/setup';
import type { ReActState, ReActCallbacks, ReActResponse } from './types';

export class ReActAgent extends AiGenerate {
  private state: ReActState;
  private message_handler: ReActMessageHandler;
  private tool_executor: ReActToolExecutor;

  constructor(
    ai_config: AiConfig,
    tools_config: ToolsConfig,
    max_iterations: number = 12
  ) {
    super(ai_config);

    // Initialize state
    this.state = {
      tools: {
        tools: new Map(),
        tool_name_map: new Map(),
      },
      history: {
        previous_actions: [],
        previous_thoughts: [],
      },
      session: {
        session_id: uuid(),
        task: '',
        timestamp: Date.now(),
        max_iterations,
        original_question: null,
      },
    };

    // Initialize components
    this.message_handler = new ReActMessageHandler();
    this.tool_executor = new ReActToolExecutor(this.state.tools);

    // Load base few shot examples
    const base_few_shot = load_and_convert_yaml(
      path.join(__dirname, 'react.examples.yaml')
    );

    // Initialize tools from configuration
    const available_tools = init_tools_from_config(tools_config);

    // Store tools by their primary name and build alternative name mapping
    available_tools.forEach((tool) => {
      const primary_name = tool.name.toLowerCase();
      this.state.tools.tools.set(primary_name, tool);

      // Add mapping for the primary name itself
      this.state.tools.tool_name_map.set(primary_name, primary_name);

      // Add mappings for alternative names if they exist
      if (tool.alternative_names) {
        tool.alternative_names.forEach((alt_name) => {
          this.state.tools.tool_name_map.set(
            alt_name.toLowerCase(),
            primary_name
          );
        });
      }
    });

    const tools_few_shot = get_tool_examples(tools_config);
    const tools_description = get_tools_for_prompt(available_tools);

    const system_instructions = Handlebars.compile(react_instruction_template)({
      base_few_shot,
      tools: tools_description,
      tools_few_shot,
      max_iterations: this.state.session.max_iterations,
    });

    this.message_handler.add_message({
      role: 'system',
      content: system_instructions,
    });
  }

  // Getters for state
  get session_id(): string {
    return this.state.session.session_id;
  }

  get current_state(): ReActState {
    return { ...this.state };
  }

  private async handle_max_iterations_reached(
    callbacks?: ReActCallbacks
  ): Promise<void> {
    const recent_thoughts = this.message_handler
      .get_messages()
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
      max_iterations: this.state.session.max_iterations,
      original_question: this.state.session.original_question,
      recent_thoughts,
    });

    callbacks?.onToolObservation?.({
      data: max_iterations_reached,
      is_error: true,
    });

    this.message_handler.add_message({
      role: 'user',
      name: 'tool_observation',
      content: `[Tool Observation] ${max_iterations_reached}`,
    });
  }

  private async get_model_response(
    callbacks?: ReActCallbacks
  ): Promise<string> {
    try {
      const context_messages = this.message_handler.get_context_messages();

      const response = await super.get_completion(
        context_messages,
        { type: 'json_object' },
        {
          onRetry: callbacks?.onRetry,
          onCompletion: (completion) => {
            if (completion.usage) {
              this.message_handler.track_token_usage({
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

  private parse_react_response(response_text: string): ReActResponse {
    if (!response_text.trim()) {
      throw new ReActResponseError('Empty response from model');
    }

    const prepare_react_response = (response: unknown): unknown => {
      if (typeof response === 'string') {
        try {
          return JSON.parse(response);
        } catch (e) {
          throw new ReActResponseError('Invalid JSON response', {
            response: response_text,
            validation_errors: ['Invalid JSON format'],
          });
        }
      }
      return response;
    };

    try {
      const parsed_json = prepare_react_response(response_text);
      return react_response_schema.parse(parsed_json);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ReActResponseError('Invalid response structure', {
          response: response_text,
          validation_errors: error.errors.map((e) => e.message),
        });
      }
      throw error;
    }
  }

  private async process_iteration(
    iterations: number,
    callbacks?: ReActCallbacks
  ): Promise<{ is_final: boolean; answer?: string }> {
    try {
      const response_text = await this.get_model_response(callbacks);
      const parsed_response = this.parse_react_response(response_text);

      if (parsed_response.thought) {
        this.state.history.previous_thoughts.push(parsed_response.thought);
      }

      this.message_handler.add_message({
        role: 'assistant',
        content: response_text,
      });

      if (parsed_response.final_answer) {
        callbacks?.onFinalAnswer?.(parsed_response.final_answer);
        return { is_final: true, answer: parsed_response.final_answer };
      }

      if (parsed_response.action && parsed_response.input !== undefined) {
        const observation = await this.tool_executor.execute(
          parsed_response.action,
          parsed_response.input
        );

        // Track the action and its observation
        this.state.history.previous_actions.push({
          action: parsed_response.action,
          input: parsed_response.input,
          observation,
        });

        callbacks?.onToolObservation?.({
          data: observation,
          is_error: false,
        });

        this.message_handler.add_message({
          role: 'user',
          name: 'tool_observation',
          content: `[Tool Observation] ${observation}`,
        });
      }

      return { is_final: false };
    } catch (error) {
      const error_observation = this.handle_error(error);

      // Track failed actions too
      if (error instanceof ReActToolError) {
        this.state.history.previous_actions.push({
          action: error.details?.tool_name || 'unknown',
          input: error.details?.input,
          observation: `Error: ${error_observation}`,
        });
      }

      callbacks?.onToolObservation?.({
        data: `Error: ${error_observation}`,
        is_error: true,
      });

      this.message_handler.add_message({
        role: 'user',
        name: 'tool_observation',
        content: `[Tool Observation] Error: ${error_observation}`,
      });

      return { is_final: false };
    }
  }

  private handle_error(error: unknown): string {
    if (error instanceof ReActToolError) {
      return `Tool Error: ${error.message}`;
    }
    if (error instanceof ReActResponseError) {
      return `Response Error: ${error.message}`;
    }
    if (error instanceof ReActIterationError) {
      return `Iteration Error: ${error.message}`;
    }
    if (error instanceof AiError) {
      let errorMessage = error.message;
      if (error.status) {
        errorMessage = `${error.status} status code - ${errorMessage}`;
      }
      return errorMessage;
    }
    return error instanceof Error ? error.message : String(error);
  }

  async answer(question: string, callbacks?: ReActCallbacks): Promise<string> {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }

    try {
      // Initialize state for new question
      this.state = {
        ...this.state,
        history: {
          previous_actions: [],
          previous_thoughts: [],
        },
        session: {
          ...this.state.session,
          task: question,
          original_question: question,
          timestamp: Date.now(),
        },
      };

      this.message_handler.add_message({ role: 'user', content: question });

      let iterations = 0;

      while (iterations < this.state.session.max_iterations) {
        iterations++;
        callbacks?.onIteration?.(iterations);

        if (iterations === this.state.session.max_iterations) {
          await this.handle_max_iterations_reached(callbacks);
        }

        const result = await this.process_iteration(iterations, callbacks);

        if (result.is_final) {
          return result.answer!;
        }

        if (
          iterations === this.state.session.max_iterations &&
          !result.is_final
        ) {
          const forced_answer = `I apologize, but I must stop here as I've reached the maximum allowed iterations and have not yet reached a final answer. Please try again with a differently worded question.`;
          callbacks?.onFinalAnswer?.(forced_answer);
          return forced_answer;
        }
      }

      throw new ReActIterationError('Maximum iterations reached unexpectedly', {
        iteration: iterations,
        max_iterations: this.state.session.max_iterations,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.errors = [...(this.state.errors || []), err];
      throw err;
    }
  }

  public override cleanup(): void {
    this.abort();
    this.state.tools.tools.clear();
    this.state.tools.tool_name_map.clear();
    this.state.history.previous_actions = [];
    this.state.history.previous_thoughts = [];
    this.message_handler.clear();
    super.cleanup();
    console.log('ReActAgent cleanup completed');
  }
}
