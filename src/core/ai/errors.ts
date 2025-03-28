// ~/src/core/ai/errors.ts
// AI-related error classes

export class AiError extends Error {
  constructor(
    message: string,
    public readonly attempt?: number,
    public readonly status?: number,
    public readonly headers?: Record<string, string>,
    public readonly errorDetails?: Record<string, any>
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export class ContentModerationError extends AiError {
  constructor(
    message: string,
    attempt?: number,
    status?: number,
    headers?: Record<string, string>,
    errorDetails?: Record<string, any>
  ) {
    super(message, attempt, status, headers, errorDetails);
    this.name = 'ContentModerationError';
  }
}
