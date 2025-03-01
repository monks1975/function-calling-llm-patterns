// ~/src/PlanExecute/planning.agent.ts

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { AiGenerate, ContentModerationError } from './ai';

import { available_tools } from './planning.schema';
import { plan_schema, plan_json_schema } from './planning.schema';
import { templates } from './planning.messages';

import { format_zod_error, create_safe_plan } from './helpers';
import { process_template } from './helpers';

import type { AiConfig } from './ai';
import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import type { ExampleData, Plan } from './planning.schema';

export class PlanningAgent extends AiGenerate {
  private examples: Array<{
    request: string;
    plan: Plan;
  }> = [];
  private max_retries = 3;

  constructor(config: AiConfig) {
    super(config);
    this.load_examples();
  }

  /**
   * Loads examples from the YAML file
   */
  private load_examples(): void {
    try {
      const examples_path = path.join(__dirname, 'planning.examples.yaml');
      const file_contents = fs.readFileSync(examples_path, 'utf8');
      const data = yaml.load(file_contents) as ExampleData;
      this.examples = data.examples;
    } catch (error) {
      console.error('Failed to load examples:', error);
    }
  }

  /**
   * Handles content moderation issues and returns a safe plan
   */
  private handle_moderation(goal: string, message: string): Plan {
    console.log(message);
    this.reset_messages();
    return create_safe_plan(goal);
  }

  /**
   * Checks if a string contains content moderation keywords
   */
  private is_moderation_content(text: string): boolean {
    const moderation_keywords = [
      'harmful',
      'illegal',
      'content policy',
      'violates',
      'inappropriate',
      'cannot provide',
      'content filter',
    ];

    return moderation_keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Handles retry logic with error messaging
   */
  private process_retry(
    retry_count: number,
    error_type: string,
    error_message: string,
    template_name: keyof typeof templates,
    template_vars: Record<string, any> = {}
  ): { should_continue: boolean; retry_count: number; error_to_throw?: Error } {
    if (retry_count >= this.max_retries) {
      return {
        should_continue: false,
        retry_count,
        error_to_throw: new Error(
          `Failed to ${error_type} after ${this.max_retries} attempts: ${error_message}`
        ),
      };
    }

    const error_prompt = process_template(
      templates[template_name],
      template_vars
    );

    this.add_message({
      role: 'user',
      content: error_prompt,
    });

    retry_count++;
    console.log(
      `Retrying plan generation due to ${error_type} (attempt ${retry_count}/${this.max_retries})...`
    );

    return { should_continue: true, retry_count };
  }

  /**
   * Generates a structured plan based on the provided goal
   * @param goal The goal to create a plan for
   * @returns A structured plan object
   */
  async create_plan(goal: string): Promise<Plan> {
    // Build system prompt with examples using our template processor
    const system_prompt = process_template(templates.system_prompt, {
      tools: available_tools.join(', '),
      examples: this.examples,
    });

    this.add_message({
      role: 'system',
      content: system_prompt,
    });

    // Add user message with goal
    const user_prompt = process_template(templates.user_goal_prompt, { goal });
    this.add_message({
      role: 'user',
      content: user_prompt,
    });

    // Use JSON mode to get structured output
    const response_format: ChatCompletionCreateParamsBase['response_format'] = {
      type: 'json_object',
      // @ts-ignore
      response_format: { type: 'json_object', schema: plan_json_schema },
    };

    let retry_count = 0;

    while (retry_count <= this.max_retries) {
      try {
        const json_response = await this.get_completion(
          this.get_messages(),
          response_format
        );

        // Check for content moderation in response text
        if (this.is_moderation_content(json_response)) {
          return this.handle_moderation(
            goal,
            'Content moderation detected in response. Returning safe plan.'
          );
        }

        let parsed_json;
        try {
          // First try to parse the JSON
          parsed_json = JSON.parse(json_response);
        } catch (parse_error: unknown) {
          const error_message =
            parse_error instanceof Error
              ? parse_error.message
              : String(parse_error);

          const retry_result = this.process_retry(
            retry_count,
            'parse JSON',
            error_message,
            'json_parse_error',
            {
              error: error_message,
              tools: available_tools.join(', '),
            }
          );

          if (retry_result.error_to_throw) {
            throw new Error(
              `Failed to parse JSON after ${
                this.max_retries
              } attempts. Response was not valid JSON: ${json_response.substring(
                0,
                100
              )}...`
            );
          }

          retry_count = retry_result.retry_count;
          continue;
        }

        // Now validate with Zod
        try {
          const parsed_plan = plan_schema.parse(parsed_json);
          return parsed_plan;
        } catch (zod_error) {
          if (zod_error instanceof z.ZodError) {
            const formatted_error = format_zod_error(zod_error);

            const retry_result = this.process_retry(
              retry_count,
              'validate plan',
              formatted_error,
              'validation_error',
              { error: formatted_error }
            );

            if (retry_result.error_to_throw) {
              throw retry_result.error_to_throw;
            }

            retry_count = retry_result.retry_count;
          } else {
            throw zod_error;
          }
        }
      } catch (error: unknown) {
        // Check for content moderation errors
        if (error instanceof ContentModerationError) {
          return this.handle_moderation(
            goal,
            'Content moderation triggered. Returning safe plan.'
          );
        }

        // Also check for error messages that might indicate content policy violations
        if (
          error instanceof Error &&
          this.is_moderation_content(error.message)
        ) {
          return this.handle_moderation(
            goal,
            'Content policy violation detected in error message. Returning safe plan.'
          );
        }

        // Handle other errors from get_completion
        const error_message =
          error instanceof Error ? error.message : String(error);

        const retry_result = this.process_retry(
          retry_count,
          'generate plan',
          error_message,
          'general_error',
          { tools: available_tools.join(', ') }
        );

        if (retry_result.error_to_throw) {
          throw new Error(`Failed to generate plan: ${error_message}`);
        }

        retry_count = retry_result.retry_count;
      }
    }

    // This should never be reached due to the throw in the loop, but TypeScript needs it
    throw new Error(
      `Failed to generate a valid plan after ${this.max_retries} attempts.`
    );
  }
}
