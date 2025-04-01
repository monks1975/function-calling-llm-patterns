// ~/src/react/types.ts
// ReAct-specific type definitions

import type { AiCallbacks } from '../core/types';
import type { react_response_schema } from './react.schema';
import type { ToolDefinition } from './tools/setup';
import type { z } from 'zod';

// Core ReAct response type
export type ReActResponse = z.infer<typeof react_response_schema>;

// ReAct callbacks extending base AI callbacks
export interface ReActCallbacks extends AiCallbacks {
  onChunk?: (chunk: string) => void;
  onToolObservation?: (observation: {
    data: string;
    is_error: boolean;
  }) => void;
  onFinalAnswer?: (answer: string) => void;
  onIteration?: (count: number) => void;
  onError?: (error: Error) => void;
}

// Types for action/observation history
export interface ReActAction {
  action: string;
  input: unknown;
  observation: string;
}

// Token usage tracking
export interface ReActTokenUsage {
  source: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Evidence record for tracking results
export interface ReActEvidenceRecord {
  session_id: string;
  evidence_id: string;
  content: string;
  created_at: number;
  step_type: 'thought' | 'action' | 'observation' | 'final_answer';
}

// Tool state management
export interface ReActToolState {
  tools: Map<string, ToolDefinition>;
  tool_name_map: Map<string, string>;
}

// History state management
export interface ReActHistoryState {
  previous_actions: ReActAction[];
  previous_thoughts: string[];
  token_usage?: ReActTokenUsage[];
}

// Session state management
export interface ReActSessionState {
  session_id: string;
  user_input: string;
  timestamp: number;
  max_iterations: number;
  final_answer?: string;
}

// Core ReAct state interface
export interface ReActState {
  tools: ReActToolState;
  history: ReActHistoryState;
  session: ReActSessionState;
  errors?: Error[];
}

// Configuration for ReAct agent
export interface ReActConfig {
  max_iterations: number;
  tools: ReActToolState;
  history: ReActHistoryState;
  session: ReActSessionState;
}
