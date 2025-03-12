// ~/src/ReWOO/events.ts

import { Observable, Subject, filter, share } from 'rxjs';
import type { ChatCompletion } from 'openai/resources/chat';
import type { Step, State } from './types';

// Define a discriminated union of events
export type ReWOOEvent =
  | { type: 'plan_created'; plan: Partial<State> }
  | { type: 'tool_start'; step: Step; args: string }
  | { type: 'tool_complete'; step: Step; result: string }
  | { type: 'solution_found'; solution: string; state: State }
  | { type: 'info'; message: string }
  | { type: 'retry'; attempt: number; error: Error; backoff_ms: number }
  | { type: 'error'; error: Error; context?: string; step?: Step }
  | {
      type: 'completion';
      completion: ChatCompletion;
      source: 'planner' | 'solver' | 'llm';
    };

export class EventBus {
  private events$ = new Subject<ReWOOEvent>();

  // Public observable that shares a single subscription
  public readonly events = this.events$.pipe(share());

  // Publish an event
  emit(event: ReWOOEvent): void {
    this.events$.next(event);
  }

  // Helper methods to get specific event types
  onPlanCreated(): Observable<ReWOOEvent & { type: 'plan_created' }> {
    return this.events.pipe(
      filter(
        (e): e is ReWOOEvent & { type: 'plan_created' } =>
          e.type === 'plan_created'
      )
    );
  }

  onToolStart(): Observable<ReWOOEvent & { type: 'tool_start' }> {
    return this.events.pipe(
      filter(
        (e): e is ReWOOEvent & { type: 'tool_start' } => e.type === 'tool_start'
      )
    );
  }

  onToolComplete(): Observable<ReWOOEvent & { type: 'tool_complete' }> {
    return this.events.pipe(
      filter(
        (e): e is ReWOOEvent & { type: 'tool_complete' } =>
          e.type === 'tool_complete'
      )
    );
  }

  onSolutionFound(): Observable<ReWOOEvent & { type: 'solution_found' }> {
    return this.events.pipe(
      filter(
        (e): e is ReWOOEvent & { type: 'solution_found' } =>
          e.type === 'solution_found'
      )
    );
  }

  onError(): Observable<ReWOOEvent & { type: 'error' }> {
    return this.events.pipe(
      filter((e): e is ReWOOEvent & { type: 'error' } => e.type === 'error')
    );
  }

  onCompletion(): Observable<ReWOOEvent & { type: 'completion' }> {
    return this.events.pipe(
      filter(
        (e): e is ReWOOEvent & { type: 'completion' } => e.type === 'completion'
      )
    );
  }
}

// Create a singleton instance
export const event_bus = new EventBus();
