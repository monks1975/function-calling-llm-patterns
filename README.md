# Dojo Function Calling Examples

This repository contains three different approaches to implementing function calling with Large Language Models (LLMs). Each example demonstrates a unique method of enabling LLMs to interact with external functions and tools.

## 1. ReACT Pattern Implementation

Located in the `/ReACT` directory, this implementation follows the Reasoning and Acting (ReACT) pattern, which combines reasoning and action in a structured format. The ReACT pattern enables LLMs to interact with external tools while maintaining a clear chain of thought.

### Key Features:

- Step-by-step reasoning through complex problems
- Standardized tool interface for extensibility
- Thought scratchpad for tracking reasoning chain
- Decision making based on tool outputs and previous results
- Support for multiple LLM providers (OpenAI, Together, etc)

### Available Tools:

- Calculator - Perform mathematical calculations
- Web Search - Search the internet for information
- Library Search - Query a specialized knowledge base

### Key Files:

- `react.agent.ts` - Core ReACT agent implementation
- `react.instructions.ts` - System prompts and instructions
- `tools/` - Directory containing available tools and helpers

### Setup Requirements:

- Node.js v20 or higher
- Environment variables:
  - `OPENAI_API_KEY` - OpenAI API key
  - `TOGETHER_API_KEY` - Together AI API key
  - `ANTHROPIC_API_KEY` - Anthropic API key
  - `GROQ_API_KEY` - Groq API key
  - `DEEPSEEK_API_KEY` - DeepSeek API key
  - `DOJO_API_KEY` - Dojo service API key
  - `DOJO_API_BASE_URL` - Dojo service base URL
  - `DOJO_API_LIBRARY_UUID` - UUID for library tool

## 2. Simple Function Calling

Located in the `/Function-calling` directory, this implementation uses the native function calling capabilities provided by modern LLM APIs. It demonstrates a straightforward approach to enabling LLMs to invoke predefined functions.

### Key Features:

- Direct function definitions using OpenAI's function calling format
- Automatic parameter validation and type checking
- Simplified response handling
- Support for synchronous and asynchronous functions
- Built-in error handling and recovery

### Available Functions:

- get_weather(location: string) - Retrieve weather data for a location
- search_database(query: string) - Search internal knowledge base
- format_response(data: object) - Format data into user-friendly responses

### Key Files:

- `function-caller.ts` - Core function calling implementation
- `functions/` - Directory containing function definitions
- `validators/` - Input/output validation schemas

### Benefits:

- More direct and simpler implementation compared to ReACT
- Lower latency due to fewer back-and-forth exchanges
- Easier to maintain and extend with new functions
- Better suited for straightforward, single-step operations

## 3. Advanced Function Calling with Database (Functions-DB)

Located in the `/Functions-DB` directory, this implementation extends the basic function calling approach with database integration capabilities. This version is specifically optimized for OpenAI models like GPT-4 and requires an OpenAI API key.

### Key Features:

- Direct database querying through LLM function calls
- Structured data handling and validation
- Transaction support for data modifications
- Query result caching and optimization
- Automatic schema inference and validation

### Available Functions:

- query_database(sql: string) - Execute SQL queries safely
- update_records(table: string, data: object) - Modify database records
- describe_schema() - Get database structure information
- validate_query(sql: string) - Check query safety and correctness

### Key Files:

- `db-function-caller.ts` - Core database function calling logic
- `db-functions/` - Database-specific function implementations
- `schemas/` - Database schema definitions and validators
- `cache/` - Query result caching implementation

### Benefits:

- Safe and controlled database access through LLM
- Reduced latency with caching mechanisms
- Built-in security measures for database operations
- Automatic query optimization suggestions

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys
3. Install dependencies:
