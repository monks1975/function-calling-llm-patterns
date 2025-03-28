// ~/src/core/types/ai.ts
// AI-related types and interfaces

export interface AiConfig {
  base_url?: string;
  api_key: string;
  model: string;
  max_tokens?: number | null;
  temperature?: number;
  timeout_ms?: number;
  max_retries?: number;
}

export interface AiCallbacks {
  onCompletion?: (completion: any) => void;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface AiRetryNotification {
  attempt: number;
  error: Error;
  max_retries: number;
}

export type AiName = 'planner' | 'solver' | 'llm';
