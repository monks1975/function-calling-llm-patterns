// ~/src/ReWOO/types.ts
import { z } from 'zod';

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
  execute(args: string): Promise<string>;
}

// Callbacks for handling events
export interface ReWOOCallbacks {
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
