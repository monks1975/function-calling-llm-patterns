// ~/src/react/errors.ts
// ReAct-specific error types

export class ReActToolError extends Error {
  constructor(
    message: string,
    public readonly details?: {
      available_tools?: string[];
      tool_name?: string;
      input?: unknown;
    }
  ) {
    super(message);
    this.name = 'ReActToolError';
  }
}

export class ReActResponseError extends Error {
  constructor(
    message: string,
    public readonly details?: {
      response?: string;
      validation_errors?: string[];
    }
  ) {
    super(message);
    this.name = 'ReActResponseError';
  }
}

export class ReActIterationError extends Error {
  constructor(
    message: string,
    public readonly details?: {
      iteration?: number;
      max_iterations?: number;
      recent_thoughts?: string[];
    }
  ) {
    super(message);
    this.name = 'ReActIterationError';
  }
}
