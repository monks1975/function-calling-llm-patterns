// ~/src/core/types/events.ts
// Event-related types and interfaces

export interface EventBus {
  emit(event: Event): void;
}

export interface Event {
  type: string;
  error?: Error;
  context?: string;
  completion?: any;
  source?: string;
}
