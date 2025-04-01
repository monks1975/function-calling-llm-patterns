// ~/src/rewoo/types.ts
// ReWOO-specific types

import { z } from 'zod';
import type { ChatCompletion } from 'openai/resources/chat';

// Step definition schema
export const ReWooStepSchema = z.object({
  plan: z.string(),
  variable: z.string().regex(/^#E\d+$/),
  tool: z.string(),
  args: z.string(),
});

export type ReWooStep = z.infer<typeof ReWooStepSchema>;

// State schema for tracking execution
export const ReWooStateSchema = z.object({
  session_id: z.string(),
  task: z.string(),
  plan_string: z.string().optional(),
  steps: z.array(ReWooStepSchema).optional(),
  results: z.record(z.string()).optional(),
  result: z.string().optional(),
  timestamp: z.number().optional(),
  errors: z.array(z.string()).optional(),
  token_usage: z
    .array(
      z.object({
        source: z.enum(['planner', 'solver', 'llm']),
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
      })
    )
    .optional(),
});

export type ReWooState = z.infer<typeof ReWooStateSchema>;

// Tool interface for all tools to implement
export interface ReWooTool {
  name: string;
  description: string;
  execute(args: string): Promise<string>;
}

// Base completion type used throughout the application
export type ReWooCompletion = ChatCompletion & {
  _request_id?: string | null;
};

// EvidenceRecord is a record of evidence for a session
export interface ReWooEvidenceRecord {
  session_id: string;
  evidence_id: string; // E1, E2, etc.
  content: string;
  created_at: number;
  step_variable: string;
}

export interface ReWooPlanExample {
  task: string;
  required_tools: string[];
  plan_steps: string[];
}
