// ~/src/ReWOO/types.ts
import { z } from 'zod';

import type { ChatCompletion } from 'openai/resources/chat';

// Step definition schema
export const StepSchema = z.object({
  plan: z.string(),
  variable: z.string().regex(/^#E\d+$/),
  tool: z.string(),
  args: z.string(),
});

export type Step = z.infer<typeof StepSchema>;

// State schema for tracking execution
export const StateSchema = z.object({
  session_id: z.string(),
  task: z.string(),
  plan_string: z.string().optional(),
  steps: z.array(StepSchema).optional(),
  results: z.record(z.string()).optional(),
  result: z.string().optional(),
  timestamp: z.number().optional(),
  errors: z.array(z.string()).optional(),
});

export type State = z.infer<typeof StateSchema>;

// Tool interface for all tools to implement
export interface Tool {
  name: string;
  description: string;
  callbacks?: ToolCallbacks;
  execute(args: string): Promise<string>;
}

// Base completion type used throughout the application
export type CompletionWithRequestId = ChatCompletion & {
  _request_id?: string | null;
};

export interface AiRetryNotification {
  type: 'retry';
  attempt: number;
  backoff_ms: number;
  error: string;
  status?: number;
  headers?: Record<string, string>;
  errorDetails?: Record<string, any>;
}

// Core callbacks for AI operations
export interface AiCallbacks {
  onRetry?: (notification: AiRetryNotification) => void;
  onCompletion?: (completion: CompletionWithRequestId) => void;
}

// Tool-specific callbacks extend AI callbacks
export interface ToolCallbacks extends AiCallbacks {
  onExecuteStart?: (args: string) => void;
  onExecuteComplete?: (result: string) => void;
  onExecuteError?: (error: Error) => void;
}

// ReWOO-specific callbacks extend AI callbacks
export interface ReWOOCallbacks extends AiCallbacks {
  onPlan?: (state: State) => void;
  onToolExecute?: (step: Step, result: string) => void;
  onSolve?: (state: State) => void;
  onError?: (error: Error, state: State) => void;
}

// EvidenceRecord is a record of evidence for a session
export interface EvidenceRecord {
  session_id: string;
  evidence_id: string; // E1, E2, etc.
  content: string;
  created_at: number;
  step_variable: string;
}
