# OpenAI Node Tool Calls

A comprehensive framework for implementing function calling with Large Language Models (LLMs), featuring multiple approaches including ReACT pattern, simple function calling, and database integration.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Tool Usage](#tool-usage)
- [Streaming API](#streaming-api)
- [Implementation Approaches](#implementation-approaches)
- [Using Local Models](#using-local-models)

## Installation

### Prerequisites

- Node.js v20 or higher
- npm or yarn

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/openai-node-tool-calls.git
   cd openai-node-tool-calls
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key
   CEREBRAS_API_KEY=your_cerebras_api_key
   TOGETHER_API_KEY=your_together_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GROQ_API_KEY=your_groq_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   DOJO_API_KEY=your_dojo_api_key
   DOJO_API_BASE_URL=your_dojo_base_url
   DOJO_API_LIBRARY_UUID=your_library_uuid
   ```

## Getting Started

### Running the CLI

To start the interactive ReACT CLI:

```bash
npm run react-cli
```

This launches an interactive session where you can ask questions and see the agent's thought process, actions, and final answers in real-time.

### Running the API Server

To start the ReACT API server:

```bash
npm run react-api
```

The server will start on port 3000 (or the port specified in your environment variables).

### Other Implementations

To run the simple function calling example:

```bash
npm run functions
```

To run the database-integrated function calling example:

```bash
npm run functions_db
```

## Architecture

The system is built with a modular architecture that separates concerns and allows for flexibility in implementation.

### Core Components

1. **ReActAgent (`react.agent.ts`)**:

   - The main agent implementation that orchestrates the ReACT pattern
   - Manages the conversation flow between the user, LLM, and tools
   - Handles error recovery and content moderation

2. **AI Interface (`ai.ts`)**:

   - Provides a unified interface to different LLM providers
   - Manages API calls, retries, and response handling
   - Supports streaming responses from the LLM

3. **Tools System (`tools/`)**:

   - Modular tool definitions with standardized interfaces
   - Each tool has its own schema, execution logic, and examples
   - Tools are dynamically loaded based on configuration

4. **Streaming (`react.stream.ts`)**:

   - Implements Node.js Readable streams for real-time output
   - Controls the pacing and formatting of streamed content
   - Supports streaming thoughts, actions, and final answers

5. **API Server (`api.ts`)**:
   - Express-based REST API for remote access
   - Server-Sent Events (SSE) for streaming responses
   - Request validation and error handling

### Data Flow

1. User submits a question
2. Agent sends the question to the LLM
3. LLM responds with thoughts, actions, and inputs
4. Agent executes the requested tool with the provided input
5. Tool results are sent back to the LLM as observations
6. Process repeats until the LLM provides a final answer
7. Final answer is returned to the user

## Tool Usage

The system supports a variety of tools that can be enabled or disabled via configuration.

### Available Tools

1. **Calculator**

   - Performs mathematical calculations using the mathjs library
   - Supports complex expressions, unit conversions, and more

2. **Web Search**

   - Searches the internet for real-time information
   - Returns structured results with snippets and URLs

3. **Library Search**

   - Queries a specialized knowledge base
   - Useful for domain-specific information retrieval

4. **Database Tool** (Functions-DB implementation)
   - Executes SQL queries safely
   - Supports schema inference and validation

### Adding Custom Tools

To add a new tool:

1. Create a new file in the `src/ReAct/tools/` directory (e.g., `mytool.tool.ts`)
2. Implement the tool interface with schema, execution logic, and examples
3. Register the tool in `setup.ts`
4. Enable the tool in your configuration

Example tool implementation:

```typescript
// mytool.tool.ts
import { z } from 'zod';
import { create_tool } from './helpers';

// Define the input schema
const schema = z.object({
  parameter1: z.string().describe('Description of parameter1'),
  parameter2: z.number().describe('Description of parameter2'),
});

// Create and export the tool
export const mytool = create_tool({
  name: 'mytool',
  description: 'Description of what this tool does',
  schema,
  execute: async (input) => {
    // Implementation logic
    const result = `Processed ${input.parameter1} with value ${input.parameter2}`;
    return { result };
  },
});
```

## Streaming API

The system provides real-time streaming of agent responses through both the CLI and API interfaces.

### Stream Configuration

You can configure what gets streamed:

```typescript
const stream_config = {
  stream_thoughts: true, // Stream the agent's thought process
  stream_actions: true, // Stream actions and inputs
};
```

### API Streaming

The API uses Server-Sent Events (SSE) to stream responses to clients:

```javascript
// Client-side example
const eventSource = new EventSource('/api/ask');

eventSource.onmessage = (event) => {
  const chunk = event.data;
  // Process the streamed chunk
  console.log(chunk);
};

eventSource.onerror = (error) => {
  console.error('EventSource error:', error);
  eventSource.close();
};
```

### Stream Implementation

The `ReActStream` class creates a Node.js Readable stream that:

1. Processes the user's question
2. Streams the agent's thoughts, actions, and final answer
3. Controls the pacing of the output for a natural reading experience
4. Handles errors and cleanup

Example usage:

```typescript
const agent = new ReActAgent(ai_config, tools_config);
const stream = new ReActStream(agent, stream_config);
const readable = stream.create_readable_stream(question);

readable.on('data', (chunk) => {
  process.stdout.write(chunk);
});

readable.on('end', () => {
  agent.cleanup();
});
```

## Implementation Approaches

This repository contains three different approaches to implementing function calling with LLMs:

### 1. ReACT Pattern (src/ReACT/)

The ReACT (Reasoning and Acting) pattern combines reasoning and action in a structured format:

- Step-by-step reasoning through complex problems
- Standardized tool interface for extensibility
- Thought scratchpad for tracking reasoning chain
- Decision making based on tool outputs and previous results
- Support for multiple LLM providers

### 2. Simple Function Calling (src/Function-calling/)

Uses the native function calling capabilities provided by modern LLM APIs:

- Direct function definitions using OpenAI's function calling format
- Automatic parameter validation and type checking
- Simplified response handling
- Support for synchronous and asynchronous functions
- Built-in error handling and recovery

### 3. Advanced Function Calling with Database (src/Functions-DB/)

Extends the basic function calling approach with database integration:

- Direct database querying through LLM function calls
- Structured data handling and validation
- Transaction support for data modifications
- Query result caching and optimization
- Automatic schema inference and validation

## Using Local Models

### Setting up llama.cpp for Local Inference

You can run the ReACT agent with local models using llama.cpp. This is particularly useful for development, testing, or when you prefer to keep inference on your local machine.

### Installation (macOS)

1. Install llama.cpp via Homebrew:

   ```bash
   brew install llama-cpp
   ```

2. Download a compatible model. For ReACT pattern support, we recommend Qwen 2.5 7B:

   ```bash
   # Using the llama-cpp HuggingFace integration
   llama-server --hf-repo kaetemi/Qwen2.5-7B-Q5_K_M-GGUF --hf-file qwen2.5-7b-q5_k_m-imat.gguf
   ```

### Running the Local Server

Start the llama.cpp server with JSON schema support for ReACT pattern:

```bash
llama-server --hf-repo kaetemi/Qwen2.5-7B-Q5_K_M-GGUF --hf-file qwen2.5-7b-q5_k_m-imat.gguf -c 2048 --json-schema '{
  "type": "object",
  "properties": {
    "thought": {
      "type": "string"
    },
    "input": {
      "oneOf": [
        { "type": "string" },
        { "type": "object" },
        { "type": "null" }
      ]
    },
    "action": {
      "type": ["string", "null"]
    },
    "final_answer": {
      "type": ["string", "null"]
    }
  },
  "required": ["thought"]
}'
```

This command:

- Loads the Qwen 2.5 7B model in Q5_K_M quantization
- Sets the context window to 2048 tokens
- Configures JSON output format compatible with the ReACT pattern

### Configuring the ReACT Agent

Update your `.env` file to point to the local llama.cpp server:

```
# Local model configuration
TOGETHER_API_KEY=not-needed-for-local
LOCAL_MODEL_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_MODEL_NAME=qwen2.5-7b-q5_k_m-imat.gguf
```

Then in your code or configuration, set the base URL to the local server:

```typescript
// Example configuration in load_ai_config()
return {
  base_url: 'http://127.0.0.1:8080/v1',
  api_key: together_api_key, // Can be any string for local server
  model: 'qwen2.5-7b-q5_k_m-imat.gguf',
  max_tokens: null,
  temperature: 0.6,
  // ... other configuration options
};
```

### Performance Considerations

- Local inference speed depends on your hardware capabilities
- For better performance on CPU-only systems, consider using smaller models or higher quantization levels
- GPU acceleration significantly improves inference speed if available

## License

This project is licensed under the ISC License - see the LICENSE file for details.
