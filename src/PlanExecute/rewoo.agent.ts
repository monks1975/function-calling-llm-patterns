// ~/src/PlanExecute/rewoo.agent.ts

import { BaseAgent, type AgentConfig } from './base.agent';
import { get_planner_prompt, get_solver_prompt } from './helpers';
import { Logger } from './logger';
import { solution_schema, plan_schema } from './types';

import type { AiCallbacks } from './ai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { Plan, Evidence, Solution, Action } from './types';
import type { ToolDefinition, ToolRegistry, ExecutionState } from './types';

/**
 * The Planner class is responsible for creating a plan based on a query.
 * It generates a sequence of actions with tool selections and reasoning.
 */
export class Planner extends BaseAgent {
  constructor(config: AgentConfig, tool_registry: ToolRegistry) {
    super({
      ...config,
      system_prompt: config.system_prompt || get_planner_prompt(tool_registry),
    });
  }

  /**
   * Create a plan for the given query
   * @param query The user's query to plan for
   * @param callbacks Optional callbacks for monitoring the process
   * @returns A Plan object with actions to execute
   */
  async create_plan(query: string, callbacks?: AiCallbacks): Promise<Plan> {
    try {
      // Clear any previous conversation except system prompt
      this.reset_messages();

      // Log system prompt
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Planner system prompt:', {
          prompt: this.system_prompt,
        })
      );

      // Add the query as a user message
      const user_msg = `Create a detailed plan to answer the following query: "${query}"`;
      this.add_user_message(user_msg);

      // Log user message
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Planner user message:', { message: user_msg })
      );

      // Get completion formatted as JSON
      const plan_json = await this.get_json_completion(callbacks);

      // Log completion
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Planner completion:', { completion: plan_json })
      );

      // Parse and validate the JSON response with retries
      const validated_plan = await this.parse_and_validate_json<Plan>(
        plan_json,
        plan_schema,
        3,
        'Creating plan for query: ' + query
      );

      // Ensure query is set and default values
      if (!validated_plan.query) {
        validated_plan.query = query;
      }

      // Ensure each action has required fields
      validated_plan.actions = validated_plan.actions.map((action, index) => ({
        ...action,
        id: action.id || index + 1,
        reasoning: action.reasoning || 'No reasoning provided',
        evidence_var: action.evidence_var || `#E${index + 1}`,
      }));

      return validated_plan;
    } catch (error) {
      throw new Error(
        `Failed to create plan: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * The Worker class executes tools and collects evidence
 */
export class Worker {
  private tools: Record<string, ToolDefinition>;
  private max_execution_time_ms: number;

  constructor(config: {
    tools?: Record<string, ToolDefinition>;
    max_execution_time_ms?: number;
  }) {
    this.tools = config.tools || {};
    this.max_execution_time_ms = config.max_execution_time_ms || 30000;
  }

  /**
   * Execute a single action and collect evidence
   * @param action The action to execute
   * @param evidence_map Map of previous evidence
   * @returns Evidence from the execution
   */
  async execute_action(
    action: Action,
    evidence_map: Record<string, Evidence>
  ): Promise<Evidence> {
    // Create basic evidence structure
    const evidence: Evidence = {
      var_name: action.evidence_var,
      action_id: action.id,
      status: 'error',
      error: 'Execution not attempted',
    };

    try {
      // Get the tool
      const tool = this.tools[action.tool];

      if (!tool) {
        throw new Error(`Tool "${action.tool}" not found`);
      }

      // Build context from previous evidence
      let context_str = '';
      if (Object.keys(evidence_map).length > 0) {
        context_str = '\nAvailable context:\n';
        for (const [var_name, prev_evidence] of Object.entries(evidence_map)) {
          if (prev_evidence.status === 'success' && prev_evidence.data) {
            context_str += `${var_name}: ${
              typeof prev_evidence.data === 'string'
                ? prev_evidence.data
                : JSON.stringify(prev_evidence.data)
            }\n`;
          }
        }
      }

      // Combine input with context
      const processed_input = this.substitute_variables(
        action.input + context_str,
        evidence_map
      );

      // Set up timeout for execution
      const timeout_promise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Tool execution timed out after ${this.max_execution_time_ms}ms`
            )
          );
        }, this.max_execution_time_ms);
      });

      // Execute the tool with timeout
      const result = await Promise.race([
        tool.execute(processed_input),
        timeout_promise,
      ]);

      // Update evidence with result
      evidence.status = result.status;

      if (result.status === 'success') {
        evidence.data = result.data;

        // Store token usage if using an LLM tool
        if (result.tokens) {
          evidence.tokens = result.tokens;
        }
      } else {
        evidence.error = result.error || 'Unknown error occurred';
      }

      return evidence;
    } catch (error) {
      // Handle execution errors
      evidence.error = error instanceof Error ? error.message : String(error);
      return evidence;
    }
  }

  /**
   * Substitute variables in the input with their values from evidence_map
   */
  private substitute_variables(
    input: string,
    evidence_map: Record<string, Evidence>
  ): string {
    let result = input;

    // Replace all variable references with their values
    for (const [var_name, evidence] of Object.entries(evidence_map)) {
      if (evidence.status === 'success' && evidence.data !== undefined) {
        // For string replacement, stringify objects/arrays
        const replacement =
          typeof evidence.data === 'object'
            ? JSON.stringify(evidence.data)
            : String(evidence.data);

        // Replace all occurrences of the variable
        result = result.replace(new RegExp(var_name, 'g'), replacement);
      }
    }

    return result;
  }
}

/**
 * The Solver class combines the plan and evidence to create a solution
 */
export class Solver extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      system_prompt: config.system_prompt || get_solver_prompt(),
    });
  }

  /**
   * Create a solution based on the query, plan, and evidence
   * @param query The original user query
   * @param plan The executed plan
   * @param evidence_map Map of evidence from execution
   * @returns A Solution object with the answer
   */
  async create_solution(
    query: string,
    plan: Plan,
    evidence_map: Record<string, Evidence>,
    callbacks?: AiCallbacks
  ): Promise<Solution> {
    try {
      // Clear any previous conversation except system prompt
      this.reset_messages();

      // Log system prompt
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Solver system prompt:', {
          prompt: this.system_prompt,
        })
      );

      // Format the plan and evidence for the solver
      const formatted_context = this.format_solver_context(
        query,
        plan,
        evidence_map
      );

      // Add the context as a user message
      this.add_user_message(formatted_context);

      // Log formatted context
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Solver formatted context:', {
          context: formatted_context,
        })
      );

      // Get completion formatted as JSON
      const solution_json = await this.get_json_completion(callbacks);

      // Log completion
      this.log_handlers.forEach((handler) =>
        handler('debug', 'Solver completion:', { completion: solution_json })
      );

      // Parse and validate the JSON response with retries
      const validated_solution = await this.parse_and_validate_json<Solution>(
        solution_json,
        solution_schema,
        3,
        'Creating solution for query: ' + query
      );

      // Ensure query is set
      if (!validated_solution.query) {
        validated_solution.query = query;
      }

      return validated_solution;
    } catch (error) {
      throw new Error(
        `Failed to create solution: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Format the context for the solver
   */
  private format_solver_context(
    query: string,
    plan: Plan,
    evidence_map: Record<string, Evidence>
  ): string {
    let context = `QUERY: ${query}\n\n`;

    // Format PLAN section
    context += 'PLAN:\n';
    for (const action of plan.actions) {
      context += `Step ${action.id}:\n`;
      context += `  Reasoning: ${action.reasoning}\n`;
      context += `  Tool: ${action.tool}\n`;
      context += `  Input: ${action.input}\n`;
      context += `  Evidence Variable: ${action.evidence_var}\n\n`;
    }

    // Format EVIDENCE section
    context += 'EVIDENCE:\n';
    for (const action of plan.actions) {
      const evidence = evidence_map[action.evidence_var];
      context += `${action.evidence_var} (Step ${action.id}):\n`;
      if (evidence) {
        if (evidence.status === 'success') {
          context += `  Status: success\n  Data: ${
            typeof evidence.data === 'string'
              ? evidence.data
              : JSON.stringify(evidence.data, null, 2)
          }\n`;
        } else {
          context += `  Status: error\n  Error: ${evidence.error}\n`;
        }
      } else {
        context += '  Status: not collected\n';
      }
      context += '\n';
    }

    context += `Based on the above plan and evidence, create a solution for the query.
Your response MUST be a JSON object with these string fields:
{
  "query": "the original query string",
  "answer": "your answer as a single string",
  "reasoning": "your reasoning as a single string"
}`;
    return context;
  }
}

/**
 * The ReWOO class orchestrates the planning, execution, and solving process
 */
export class ReWOO {
  private planner: Planner;
  private worker: Worker;
  private solver: Solver;
  private state: ExecutionState;
  private logger: Logger;

  constructor(planner: Planner, worker: Worker, solver: Solver) {
    this.planner = planner;
    this.worker = worker;
    this.solver = solver;
    this.logger = new Logger();
    this.state = {
      query: '',
      plan: null,
      current_action_index: 0,
      evidence_map: {},
      solution: null,
      start_time: Date.now(),
      tokens: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      logs: [],
    };

    // Connect base agent logs
    const log_handler = (level: string, message: string, data?: any) => {
      this.log(level as any, message, data);
    };

    this.planner.add_log_handler(log_handler);
    this.solver.add_log_handler(log_handler);
  }

  /**
   * Process a query through the full ReWOO pipeline
   * @param query The query to process
   * @returns A Solution object
   */
  async process(query: string): Promise<Solution> {
    await this.logger.init();
    this.state.query = query;
    this.state.start_time = Date.now();
    this.state.evidence_map = {};

    this.log('info', `Processing query: ${query}`, { query });

    try {
      // 1. Create plan
      this.log('info', 'Creating plan');
      this.state.plan = await this.planner.create_plan(query, {
        onCompletion: (completion: ChatCompletion) => {
          if (completion.usage) {
            this.state.tokens.prompt_tokens += completion.usage.prompt_tokens;
            this.state.tokens.completion_tokens +=
              completion.usage.completion_tokens;
            this.state.tokens.total_tokens += completion.usage.total_tokens;
          }
        },
      });
      this.log('info', 'Plan created', { plan: this.state.plan });

      // 2. Execute each action in sequence
      for (let i = 0; i < this.state.plan.actions.length; i++) {
        this.state.current_action_index = i;
        const action = this.state.plan.actions[i];

        this.log('info', `Executing action ${i + 1}: ${action.tool}`, {
          action,
        });

        // Execute the action
        const evidence = await this.worker.execute_action(
          action,
          this.state.evidence_map
        );

        // Store the evidence
        this.state.evidence_map[action.evidence_var] = evidence;

        // Accumulate token usage from tools
        if (evidence.tokens) {
          this.state.tokens.prompt_tokens += evidence.tokens.prompt_tokens;
          this.state.tokens.completion_tokens +=
            evidence.tokens.completion_tokens;
          this.state.tokens.total_tokens += evidence.tokens.total_tokens;
        }

        this.log(
          evidence.status === 'success' ? 'info' : 'error',
          `Action ${i + 1} ${evidence.status}`,
          { evidence }
        );
      }

      // 3. Create solution
      this.log('info', 'Creating solution');
      this.state.solution = await this.solver.create_solution(
        query,
        this.state.plan,
        this.state.evidence_map,
        {
          onCompletion: (completion: ChatCompletion) => {
            if (completion.usage) {
              this.state.tokens.prompt_tokens += completion.usage.prompt_tokens;
              this.state.tokens.completion_tokens +=
                completion.usage.completion_tokens;
              this.state.tokens.total_tokens += completion.usage.total_tokens;
            }
          },
        }
      );

      this.log('info', 'Solution created', { solution: this.state.solution });
    } catch (error) {
      this.log(
        'error',
        `Error in processing: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { error }
      );
      throw error;
    } finally {
      this.state.end_time = Date.now();
      await this.logger.save();
    }

    return this.state.solution!;
  }

  /**
   * Get the current state of the ReWOO process
   */
  get_state() {
    const state = { ...this.state };
    if (state.end_time) {
      state.duration_seconds = Number(
        ((state.end_time - state.start_time) / 1000).toFixed(2)
      );
    }
    return state;
  }

  /**
   * Add a log entry
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ) {
    const log_entry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.state.logs.push(log_entry);
    this.logger.add(level, message, data);
  }
}
