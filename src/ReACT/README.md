# ReAct System

A powerful implementation of the ReACT (Reasoning and Acting) pattern for Large Language Models (LLMs), featuring self-reflection, planning, and streaming capabilities.

## Overview

The ReAct system implements a structured approach to problem-solving that combines:

- Step-by-step reasoning
- Tool-based actions
- Self-reflection and planning
- Real-time streaming of thoughts and actions

## Core Components

### ReActAgent

The main agent that orchestrates the ReACT pattern:

- Manages conversation flow between user, LLM, and tools
- Handles error recovery and content moderation
- Supports self-reflection and planning
- Configurable iteration limits and planning frequency

### ReActStream

Provides real-time streaming of agent responses:

- Streams thoughts, actions, and final answers
- Configurable output pacing
- Natural reading experience with word-by-word streaming
- Background processing with proper cleanup

### ReActAgentSingleton

Singleton wrapper for CLI applications:

- Global access to a single ReActAgent instance
- Automatic cleanup on process exit
- Handles process signals (SIGINT, uncaught exceptions)

## Usage

### CLI Mode

```bash
npm run react-cli
```

### API Mode

```bash
npm run react-api
```

### Configuration

```typescript
const ai_config = {
  base_url: 'your_api_base_url',
  api_key: 'your_api_key',
  model: 'your_model_name',
  max_tokens: null,
  temperature: 0.6,
};

const tools_config = {
  enabled_tools: ['tool1', 'tool2'],
  // ... other tool configurations
};

const stream_config = {
  stream_thoughts: true,
  stream_actions: true,
};
```

## Features

### Self-Reflection and Planning

- Automatic progress assessment
- Iteration tracking
- Resource management
- Dynamic course correction

### Tool Integration

- Modular tool system
- Standardized interfaces
- Dynamic tool loading
- Error handling and recovery

### Streaming

- Real-time output
- Configurable streaming options
- Natural reading pace
- Background processing

## Architecture

1. User submits a question
2. Agent processes through ReACT cycles:
   - Thought: Reasoning about the problem
   - Action: Selecting and executing tools
   - Observation: Processing tool results
3. Self-reflection at configurable intervals
4. Final answer generation

## Error Handling

- Graceful error recovery
- Process signal handling
- Resource cleanup
- Content moderation

## License

ISC License
