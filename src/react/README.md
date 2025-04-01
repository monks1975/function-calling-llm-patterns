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

- Manages the core ReAct loop (Thought -> Action -> Observation)
- Initializes tools based on configuration
- Handles conversation history and state management
- Executes tools via `ReActToolExecutor`
- Interacts with the LLM via `AiGenerate`
- Manages error handling and iteration limits
- Provides callbacks for various events (`onChunk`, `onToolObservation`, `onFinalAnswer`, etc.)
- Contains a `cleanup` method for resource management

### ReActStream

Provides a Node.js `Readable` stream interface for agent interactions:

- Wraps a `ReActAgent` instance
- Streams thoughts, actions, and final answers in real-time
- Uses `gpt-tokenizer` for natural word/token streaming
- Configurable options:
  - `stream_thoughts`: Enable/disable thought streaming
  - `stream_actions`: Enable/disable action streaming
  - `typing_speed`: Adjusts the speed of streamed output ('slow', 'normal', 'fast')
  - `natural_pauses`: Adds delays for punctuation for a more human-like feel
- Handles background processing and stream lifecycle (creation, destruction, error handling)

### ReActAgentSingleton

Singleton wrapper for CLI applications:

- Ensures only one `ReActAgent` instance exists globally
- Provides static methods for initialization (`initialize`), getting the agent (`get_agent`), and cleanup (`cleanup`, `reset`)
- Automatically handles cleanup on process exit events (SIGINT, uncaughtException, beforeExit)
- Offers convenience methods like `answer` and `abort` that proxy to the underlying agent instance
- Suitable for applications needing a single, easily accessible agent

## Usage

### CLI Mode

```bash
npm run react-cli
```

#### ReAct CLI with Streaming

A command-line interface for interacting with ReAct Agent with streaming capabilities.

#### Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file with `CEREBRAS_API_KEY=your_api_key_here`

#### Usage

Run the CLI:

```bash
npm run react-cli
```

#### Commands

The CLI supports the following commands:

- `toggle_mode` - Switch between streaming and standard mode
- `toggle_stream` - Toggle streaming of thoughts and actions
- `toggle_thoughts` - Toggle streaming of thoughts only
- `toggle_actions` - Toggle streaming of actions only
- `q`, `quit`, `clear` - Exit the application

#### Default Tools

The CLI is configured by default with the following tools:

- `calculator`: Performs mathematical calculations.
- `search_web`: Searches the web for information.
- `thought`: Allows the agent to record internal thoughts or reflections.
- `rag`: Retrieves information from a pre-configured knowledge base (Retrieval-Augmented Generation). The default configuration points to an 'Apple History' library.

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
  stream_thoughts: false,
  stream_actions: false,
};
```

## Features

### Self-Reflection and Planning

- Automatic progress assessment
- Iteration tracking
- Resource management
- Dynamic course correction

### Tool Integration

- Modular tool system with standardized interfaces (`ToolDefinition`)
- Dynamic tool loading and configuration via `ToolsConfig`
- Tools defined with name, description, arguments (using Zod schemas), and an `execute` function
- Tool examples can be provided for few-shot prompting
- `ReActToolExecutor` handles:
  - Finding tools by primary or alternative names (case-insensitive)
  - Parsing tool input (expects JSON or object)
  - Calling the tool's `execute` method
  - Handling tool-specific errors (`ReActToolError`)
  - Returning the observation (result or error message) to the agent
- Error handling and recovery for tool execution failures

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

## Logging

- Each session (initiated by a user question in the CLI) is logged to a Markdown file.
- Logs are stored in the `src/react/logs/` directory.
- The filename format is `<session_id>_log.md`.
- Logs contain:
  - Session ID, timestamp, and the initial user input.
  - A detailed step-by-step breakdown of the ReACT process:
    - Thoughts
    - Actions taken (tool name)
    - Input provided to the tool
    - Observations received from the tool
  - Any errors encountered during the process.
  - The final answer provided to the user.
  - Token usage statistics (prompt, completion, total) broken down by source (e.g., model response).

## License

ISC License
