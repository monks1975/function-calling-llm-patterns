# ReWOO Callbacks and Events System

## Overview

ReWOO implements a two-layer event system built on Node's EventEmitter:

1. Low-level tool events (tool_start, tool_complete, error)
2. High-level process events (plan, solve)

The system provides granular control through callbacks while maintaining a pub/sub event architecture.

## Event Types

### Core Events

```typescript
type EventType =
  | 'tool_start' // Tool execution starting
  | 'tool_complete' // Tool execution completed
  | 'plan' // Planning phase complete
  | 'solve' // Solution phase complete
  | 'error' // Error occurred
  | 'completion'; // AI completion received
```

### Event Context

Each event includes execution context:

```typescript
interface ExecutionContext {
  session_id: string;
  task: string;
  step?: Step;
  tool?: string;
  args?: string;
  state?: State;
}
```

## Callback Interfaces

### Tool Callbacks

```typescript
interface ToolCallbacks {
  onExecuteStart?: (args: string) => void;
  onExecuteComplete?: (result: string, step?: Step) => void;
  onExecuteError?: (error: Error) => void;
  onCompletion?: (completion: CompletionWithRequestId) => void;
}
```

### ReWOO Callbacks

```typescript
interface ReWOOCallbacks {
  onPlan?: (state: State) => void;
  onToolExecute?: (step: Step, result: string) => void;
  onSolve?: (state: State) => void;
  onError?: (error: Error, state: State) => void;
}
```

## Usage Examples

### Registering Callbacks

```typescript
const rewoo = new ReWOO(ai_config, tools, {
  onPlan: (state) => {
    console.log('Plan created:', state.plan_string);
  },
  onToolExecute: (step, result) => {
    console.log(`Tool ${step.tool} executed:`, result);
  },
  onSolve: (state) => {
    console.log('Solution found:', state.result);
  },
  onError: (error) => {
    console.error('Error occurred:', error);
  },
});
```

### Tool Event Handling

Tools don't emit events directly. Instead, the Worker class manages tool execution and event handling:

```typescript
// Worker class handles tool execution and events
class Worker {
  private tool_callbacks?: ToolCallbacks;

  async execute_step(
    step: Step,
    results: Record<string, string> = {}
  ): Promise<string> {
    // Notify start of execution
    this.tool_callbacks?.onExecuteStart?.(processed_args);

    try {
      const result = await tool.execute(processed_args);

      // Notify completion
      this.tool_callbacks?.onExecuteComplete?.(result, step);
      return result;
    } catch (error) {
      // Notify error
      this.tool_callbacks?.onExecuteError?.(err);
      return this.execute_fallback(step.tool, processed_args);
    }
  }
}

// Tools that use AI receive callbacks through AiGenerate
class LlmTool implements Tool {
  async execute(args: string): Promise<string> {
    return await this.ai.get_completion(
      [{ role: 'user', content: args }],
      undefined,
      {
        onCompletion: (completion) => {
          this.callbacks?.onCompletion?.(completion, 'tool', this.name);
        },
      }
    );
  }
}
```

The event flow is:

1. Worker receives tool callbacks in constructor
2. Worker executes tools and triggers appropriate callbacks
3. Tools using AI pass completion callbacks through AiGenerate
4. ReWOO class maps these callbacks to high-level events

## Event Flow

1. **Tool Execution**

   - Tool starts → `tool_start` event
   - Tool completes → `tool_complete` event
   - Tool errors → `error` event

2. **Planning Phase**

   - Plan created → `plan` event
   - Plan executed → Series of tool events

3. **Solution Phase**
   - Solution found → `solve` event
   - Process complete

## Best Practices

1. **Error Handling**

   - Always include error context in error events
   - Use the error callback for graceful degradation
   - Implement fallback behavior where appropriate

2. **Event Cleanup**

   - Remove listeners when no longer needed
   - Clean up tool emitters during shutdown
   - Implement cleanup methods in tools

3. **State Management**
   - Include relevant state in event context
   - Maintain immutable state copies
   - Use state snapshots for event history

## Implementation Details

### Event Emission

The ReWOO class extends EventEmitter and overrides the emit method:

```typescript
emit<K extends keyof ReWOOEventMap>(
  event: K,
  args: ReWOOEventMap[K]
): boolean {
  this.callbacks?.onEvent?.(args);
  return super.emit(event, args);
}
```

### Event Mapping

Events are mapped to callbacks through the central event dispatcher:

```typescript
private emit_execution_event(event: ExecutionEvent): void {
  this.emit('rewoo:event', event);

  switch (event.type) {
    case 'plan':
      this.callbacks?.onPlan?.(event.context.state!);
      break;
    case 'tool_complete':
      if (event.context.step) {
        this.callbacks?.onToolExecute?.(
          event.context.step,
          event.data as string
        );
      }
      break;
    // ... other cases
  }
}
```

## Notes

- Events are type-safe through TypeScript interfaces
- Callbacks can be used for logging, monitoring, and debugging
- The system is extensible for custom event types
- Event context provides full execution traceability
