// ~/src/PlanExecute/rewoo.agent.ts

import { BaseAgent, type AgentConfig } from './base.agent';
import { get_planner_prompt, get_solver_prompt } from './helpers';

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

      // Add the query as a user message
      this.add_user_message(
        `Create a detailed plan to answer the following query: "${query}"`
      );

      // Get completion formatted as JSON
      const plan_json = await this.get_json_completion(callbacks);

      // Parse the JSON response with retries
      const plan_obj = await this.parse_json_with_retries<any>(
        plan_json,
        3,
        'Creating plan for query: ' + query
      );

      // Validate against our schema
      const validated_plan = this.validate_plan(plan_obj, query);

      return validated_plan;
    } catch (error) {
      throw new Error(
        `Failed to create plan: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate the plan against our schema
   */
  private validate_plan(plan_obj: any, query: string): Plan {
    // Ensure query is set
    plan_obj.query = plan_obj.query || query;

    // Basic validation
    if (!Array.isArray(plan_obj.actions)) {
      throw new Error('Plan must contain an array of actions');
    }

    // Ensure each action has required fields
    plan_obj.actions = plan_obj.actions.map((action: any, index: number) => {
      return {
        id: action.id || index + 1,
        tool: action.tool,
        input: action.input,
        reasoning: action.reasoning || 'No reasoning provided',
        evidence_var: action.evidence_var || `#E${index + 1}`,
      };
    });

    return plan_obj as Plan;
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

      // Substitute variables in the input
      const processed_input = this.substitute_variables(
        action.input,
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

      // Format the plan and evidence for the solver
      const formatted_context = this.format_context(query, plan, evidence_map);

      // Add the context as a user message
      this.add_user_message(formatted_context);

      // Get completion formatted as JSON
      const solution_json = await this.get_json_completion(callbacks);

      // Parse the JSON response with retries
      const solution_obj = await this.parse_json_with_retries<any>(
        solution_json,
        3,
        'Creating solution for query: ' + query
      );

      // Validate and format the solution
      return this.validate_solution(solution_obj, query);
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
  private format_context(
    query: string,
    plan: Plan,
    evidence_map: Record<string, Evidence>
  ): string {
    let context = `QUERY: ${query}\n\nPLAN AND EVIDENCE:\n`;

    // Add each action and its evidence
    for (const action of plan.actions) {
      context += `\nPlan: ${action.reasoning}\n`;
      context += `Tool: ${action.tool}\n`;
      context += `Input: ${action.input}\n`;

      // Add evidence if available
      const evidence = evidence_map[action.evidence_var];
      if (evidence) {
        context += `Evidence (${action.evidence_var}): `;
        if (evidence.status === 'success') {
          context += JSON.stringify(evidence.data).substring(0, 500);
          if (JSON.stringify(evidence.data).length > 500) {
            context += '... (truncated)';
          }
        } else {
          context += `ERROR: ${evidence.error}`;
        }
        context += '\n';
      } else {
        context += `Evidence: No evidence collected for this step\n`;
      }
    }

    context += `\nBased on the above plan and evidence, create a solution for the query.`;
    return context;
  }

  /**
   * Validate the solution against our schema
   */
  private validate_solution(solution_obj: any, query: string): Solution {
    // Ensure query is set
    solution_obj.query = solution_obj.query || query;

    // Ensure answer exists
    if (!solution_obj.answer) {
      throw new Error('Solution must contain an answer');
    }

    return {
      query: solution_obj.query,
      answer: solution_obj.answer,
      reasoning: solution_obj.reasoning || undefined,
    };
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

  constructor(planner: Planner, worker: Worker, solver: Solver) {
    this.planner = planner;
    this.worker = worker;
    this.solver = solver;
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
  }

  /**
   * Process a query through the full ReWOO pipeline
   * @param query The query to process
   * @returns A Solution object
   */
  async process(query: string): Promise<Solution> {
    this.state.query = query;
    this.state.start_time = Date.now();
    this.state.evidence_map = {};

    this.log('info', `Processing query: ${query}`, { query }, 'system');

    try {
      // 1. Create plan
      this.log('info', 'Creating plan', undefined, 'planner');
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
      this.log('info', 'Plan created', { plan: this.state.plan }, 'planner');

      // 2. Execute each action in sequence
      for (let i = 0; i < this.state.plan.actions.length; i++) {
        this.state.current_action_index = i;
        const action = this.state.plan.actions[i];

        this.log(
          'info',
          `Executing action ${i + 1}: ${action.tool}`,
          { action },
          'worker'
        );

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
          { evidence },
          'worker'
        );
      }

      // 3. Create solution
      this.log('info', 'Creating solution', undefined, 'solver');
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

      this.log(
        'info',
        'Solution created',
        { solution: this.state.solution },
        'solver'
      );
    } catch (error) {
      this.log(
        'error',
        `Error in processing: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { error },
        'system'
      );
      throw error;
    } finally {
      this.state.end_time = Date.now();
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
    data?: any,
    component?: 'planner' | 'worker' | 'solver' | 'system'
  ) {
    this.state.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
      component,
    });
  }
}
