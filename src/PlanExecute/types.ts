// ~/src/PlanExecute/types.ts

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BaseAgent, AgentConfig } from './base.agent';

// Available tools for the Worker to use
export const available_tools = ['web_search', 'calculator'] as const;

// ==================== ReWOO Core Types ====================

// Action schema - represents a single action in the plan with variable substitution
export const action_schema = z.object({
  id: z.number().describe('Action sequence number'),
  tool: z.enum(available_tools).describe('Tool to use for this action'),
  input: z
    .string()
    .describe('Input for the tool, may contain variable references'),
  reasoning: z.string().describe('Reasoning for this action'),
  evidence_var: z
    .string()
    .describe('Variable name to store evidence (e.g., #E1)'),
});

// Plan schema - sequence of actions with reasoning created by the Planner
export const plan_schema = z.object({
  query: z.string().describe('The original user query'),
  actions: z.array(action_schema).describe('Sequence of actions to execute'),
});

// Evidence schema - result from executing an action
export const evidence_schema = z.object({
  var_name: z.string().describe('Variable name (e.g., #E1)'),
  action_id: z
    .number()
    .describe('ID of the action that produced this evidence'),
  status: z.enum(['success', 'error']).describe('Execution status'),
  data: z.any().optional().describe('Result data from the action'),
  error: z.string().optional().describe('Error message if status is error'),
});

// Solution schema - final answer combining plan and evidence
export const solution_schema = z.object({
  query: z.string().describe('Original user query'),
  answer: z.string().describe('Final answer to the query'),
  reasoning: z.string().optional().describe('Reasoning process'),
});

// ==================== Type Definitions ====================

export type Action = z.infer<typeof action_schema>;
export type Plan = z.infer<typeof plan_schema>;
export type Evidence = z.infer<typeof evidence_schema>;
export type Solution = z.infer<typeof solution_schema>;

// ==================== JSON Schemas ====================

export const plan_json_schema = zodToJsonSchema(plan_schema, {
  target: 'openAi',
});
export const evidence_json_schema = zodToJsonSchema(evidence_schema, {
  target: 'openAi',
});
export const solution_json_schema = zodToJsonSchema(solution_schema, {
  target: 'openAi',
});

// ==================== Tool Types ====================

export interface ToolResult {
  status: 'success' | 'error';
  data?: any;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  execute: (params: any) => Promise<ToolResult>;
  schema: z.ZodType<any>;
  required_params?: string[];
}

export interface ToolRegistry {
  register: (tool: ToolDefinition) => void;
  get: (name: string) => ToolDefinition | undefined;
  get_all: () => Record<string, ToolDefinition>;
  get_tool_names: () => string[];
}

// ==================== Agent Types ====================

// Worker-specific configuration (doesn't need LLM-related config)
export interface WorkerConfig {
  tools?: Record<string, ToolDefinition>;
  max_execution_time_ms?: number;
}

// Execution state
export interface ExecutionState {
  query: string;
  plan: Plan | null;
  current_action_index: number;
  evidence_map: Record<string, Evidence>;
  solution: Solution | null;
  start_time: number;
  end_time?: number;
  logs: ExecutionLog[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ExecutionLog {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  component?: 'planner' | 'worker' | 'solver' | 'system';
}

// ==================== Agent Interfaces ====================

export interface PlannerInterface {
  create_plan: (query: string) => Promise<Plan>;
}

export interface WorkerInterface {
  execute_action: (
    action: Action,
    evidence_map: Record<string, Evidence>
  ) => Promise<Evidence>;
}

export interface SolverInterface {
  create_solution: (
    query: string,
    plan: Plan,
    evidence_map: Record<string, Evidence>
  ) => Promise<Solution>;
}

// ==================== Agent Classes ====================

export class Planner extends BaseAgent implements PlannerInterface {
  constructor(config: AgentConfig) {
    super(config);
  }

  async create_plan(query: string): Promise<Plan> {
    throw new Error('Not implemented');
  }
}

// Worker no longer extends BaseAgent as it doesn't need LLM functionality
export class Worker implements WorkerInterface {
  private tools: Record<string, ToolDefinition>;
  private max_execution_time_ms: number;

  constructor(config: WorkerConfig) {
    this.tools = config.tools || {};
    this.max_execution_time_ms = config.max_execution_time_ms || 30000;
  }

  async execute_action(
    action: Action,
    evidence_map: Record<string, Evidence>
  ): Promise<Evidence> {
    throw new Error('Not implemented');
  }
}

export class Solver extends BaseAgent implements SolverInterface {
  constructor(config: AgentConfig) {
    super(config);
  }

  async create_solution(
    query: string,
    plan: Plan,
    evidence_map: Record<string, Evidence>
  ): Promise<Solution> {
    throw new Error('Not implemented');
  }
}

// Main orchestrator that combines Planner, Worker, and Solver
export class ReWOO {
  private planner: Planner;
  private worker: Worker;
  private solver: Solver;
  private state: ExecutionState;

  constructor(planner: Planner, worker: Worker, solver: Solver) {
    this.planner = planner;
    this.worker = worker;
    this.solver = solver;
    this.state = this.create_initial_state();
  }

  private create_initial_state(): ExecutionState {
    return {
      query: '',
      plan: null,
      current_action_index: 0,
      evidence_map: {},
      solution: null,
      start_time: Date.now(),
      logs: [],
    };
  }

  // Substitute variables in the input string with their values from evidence_map
  private substitute_variables(
    input: string,
    evidence_map: Record<string, Evidence>
  ): string {
    let result = input;
    for (const [var_name, evidence] of Object.entries(evidence_map)) {
      if (evidence.status === 'success' && evidence.data) {
        result = result.replace(var_name, String(evidence.data));
      }
    }
    return result;
  }

  async process(query: string): Promise<Solution> {
    this.state.query = query;
    this.state.start_time = Date.now();

    // 1. Create plan
    this.state.plan = await this.planner.create_plan(query);

    // 2. Execute each action in sequence
    for (let i = 0; i < this.state.plan.actions.length; i++) {
      this.state.current_action_index = i;
      const action = this.state.plan.actions[i];

      // Substitute variables in the input
      const processed_action = {
        ...action,
        input: this.substitute_variables(action.input, this.state.evidence_map),
      };

      // Execute the action
      const evidence = await this.worker.execute_action(
        processed_action,
        this.state.evidence_map
      );

      // Store the evidence
      this.state.evidence_map[action.evidence_var] = evidence;
    }

    // 3. Create solution
    this.state.solution = await this.solver.create_solution(
      query,
      this.state.plan,
      this.state.evidence_map
    );

    this.state.end_time = Date.now();
    return this.state.solution;
  }
}
