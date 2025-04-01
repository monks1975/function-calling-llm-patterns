# OpenAI Node Tool Calls

A collection of example implementations for function calling with Large Language Models (LLMs), demonstrating different approaches and patterns.

## Quick Start

1. Clone and install:

```bash
git clone https://github.com/yourusername/openai-node-tool-calls.git
cd openai-node-tool-calls
npm install
```

2. Configure environment:

```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run any example:

```bash
# ReACT pattern CLI
npm run react-cli

# ReWOO pattern CLI
npm run plan-cli
```

## Example Modules

### 1. ReACT Pattern (`src/ReAct/`)

- Implements the ReACT (Reasoning and Acting) pattern
- Interactive CLI and API server
- Real-time streaming of thoughts and actions
- Built-in error recovery and content moderation

### 2. ReWOO Pattern (`src/ReWOO/`)

- Implements the ReWOO (Reasoning Without Output) pattern
- Focuses on planning and execution phases
- Efficient for complex multi-step tasks
- Built-in progress tracking and optimization

## Requirements

- Node.js v20 or higher
- npm or yarn
- API keys for supported LLM providers (OpenAI, Anthropic, etc.)

## License

ISC License
