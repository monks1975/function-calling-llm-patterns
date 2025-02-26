# Event System Documentation

This document explains the event system used in the ReAct framework.

## Overview

The ReAct framework uses a TypeScript-based event system that provides type safety and consistent naming conventions. The event system is built on Node.js's `EventEmitter` class and provides a way for components to communicate with each other.

## Event Types

### AiEvents

The base event interface for AI-related events:

```typescript
export interface AiEvents {
  retry: (notification: AiRetryNotification) => void;
  completion: (completion: ChatCompletion) => void;
}
```

### ReActEvents

The ReActAgent extends the AiEvents interface with additional events:

```typescript
export interface ReActEvents extends AiEvents {
  chunk: (chunk: string) => void;
  toolObservation: (observation: { data: string; is_error: boolean }) => void;
  finalAnswer: (answer: string) => void;
  iteration: (count: number) => void;
  error: (error: Error) => void;
  contentModeration: (moderation_data: {
    original_message: string;
    moderation_result: ModerationResult;
    violated_categories: string[];
  }) => void;
}
```

## Event Descriptions

### AiEvents

- **retry**: Emitted when the AI service encounters an error and will retry the request.
- **completion**: Emitted when the AI service returns a completion response.

### ReActEvents

- **chunk**: Emitted when a chunk of text is received from the AI service.
- **toolObservation**: Emitted when a tool is executed and returns a result or error.
- **finalAnswer**: Emitted when the agent has reached a final answer.
- **iteration**: Emitted at the start of each thought/action cycle.
- **error**: Emitted when an error occurs during agent execution.
- **contentModeration**: Emitted when content moderation is performed on a message.

## Usage Examples

### Listening for Events

```typescript
import { ReActAgent } from './react.agent';
import { AiConfig } from './ai';
import { ToolsConfig } from './tools/setup';

// Create a new agent
const agent = new ReActAgent(config, tools_config);

// Listen for the finalAnswer event
agent.on('finalAnswer', (answer) => {
  console.log('Final answer:', answer);
});

// Listen for tool observations
agent.on('toolObservation', (observation) => {
  if (observation.is_error) {
    console.error('Tool error:', observation.data);
  } else {
    console.log('Tool result:', observation.data);
  }
});

// Listen for content moderation events
agent.on('contentModeration', (moderation_data) => {
  console.log(
    'Content moderation triggered:',
    moderation_data.violated_categories
  );
});
```

### Using the Singleton

```typescript
import { ReActAgentSingleton } from './react.singleton';

// Initialize the singleton
ReActAgentSingleton.initialize(config, tools_config);

// Listen for events
ReActAgentSingleton.on('finalAnswer', (answer) => {
  console.log('Final answer:', answer);
});

// Get the agent instance
const agent = ReActAgentSingleton.get_agent();

// Use the agent
agent.answer('What is the capital of France?');

// Clean up when done
ReActAgentSingleton.cleanup();
```

## Event Forwarding

The `ReActAgent` class forwards events from the parent `AiGenerate` class to its own event emitter. This ensures that all events can be listened for on the `ReActAgent` instance, regardless of where they originate.

```typescript
private setupEventForwarding(): void {
  // Forward retry events
  super.on('retry', (notification) => {
    this.react_emitter.emit('retry', notification);
  });

  // Forward completion events
  super.on('completion', (completion) => {
    this.react_emitter.emit('completion', completion);
  });
}
```

## Cleanup

To prevent memory leaks, it's important to clean up event listeners when they are no longer needed:

```typescript
// Clean up a specific listener
agent.off('finalAnswer', myListener);

// Clean up all resources
agent.cleanup();
```

The `cleanup()` method removes all event listeners and releases other resources.

## Best Practices

1. **Use TypeScript**: Take advantage of TypeScript's type system to ensure type safety when working with events.
2. **Consistent Naming**: Use camelCase for event names (e.g., `finalAnswer` instead of `final-answer`).
3. **Documentation**: Document the events that a class emits in its interface definition.
4. **Cleanup**: Always clean up event listeners when they are no longer needed to prevent memory leaks.
5. **Event Placement**: Place events in the appropriate interface based on where they are primarily used.
6. **Error Handling**: Handle errors in event listeners to prevent unhandled exceptions.
