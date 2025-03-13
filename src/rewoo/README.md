# ReWOO (Reasoning WithOut Observation)

ReWOO is an innovative Augmented Language Model (ALM) system that decouples reasoning from observations to achieve efficient and scalable task execution. Based on the research paper "ReWOO: Decoupling Reasoning from Observations for Efficient Augmented Language Models" by Xu et al., this implementation provides a modular paradigm that significantly reduces token consumption while maintaining or improving performance.

## Research Context

ReWOO addresses key challenges in traditional ALM systems:

- Eliminates redundant prompts and repeated execution
- Achieves 5x token efficiency on multi-step reasoning tasks
- Improves accuracy by 4% on HotpotQA benchmark
- Demonstrates robustness under tool-failure scenarios
- Enables instruction fine-tuning to offload LLMs into smaller models

The system's architecture separates the reasoning process from external observations, allowing for:

- More efficient token usage
- Better scalability
- Improved performance on complex reasoning tasks
- Reduced model parameter requirements

## Architecture

### Core Components

1. **Planner Agent**

   - Breaks down tasks into sequential steps
   - Uses AI to create structured execution plans
   - Each step is assigned a unique evidence variable (#E1, #E2, etc.)
   - Supports fallback planning for error cases

2. **Worker**

   - Executes individual steps in the plan
   - Manages tool execution and event handling
   - Handles error cases and retries
   - Maintains execution state

3. **Solver Agent**

   - Analyzes collected evidence
   - Synthesizes final solutions
   - Provides structured summaries of evidence
   - Handles incomplete or missing information gracefully

4. **Event System**
   - Two-layer event architecture (low-level tool events and high-level process events)
   - Provides granular control through callbacks
   - Maintains execution context and state
   - Supports event-based monitoring and debugging

### Available Tools

1. **LLM Tool**

   - Direct interaction with language models
   - Supports multiple AI providers
   - Handles retries and error cases

2. **Search Tool**

   - Web search capabilities
   - Information gathering
   - External knowledge integration

3. **Memory Tools**
   - RecentMemory: Access to recent conversations
   - MemoryByKeyword: Semantic search through conversation history
   - Evidence tracking and retrieval

## Workflow

1. **Task Reception**

   - System receives a task or query
   - Initializes execution state and session

2. **Planning Phase**

   - Planner Agent creates sequential execution plan
   - Each step is assigned a unique evidence variable
   - Plan includes tool selection and arguments

3. **Execution Phase**

   - Worker executes each step in sequence
   - Tools gather evidence and information
   - Results are stored in state
   - Events track progress and errors

4. **Solving Phase**
   - Solver Agent analyzes collected evidence
   - Creates structured summaries
   - Generates final solution
   - Handles missing or incomplete information

## State Management

The system maintains a structured state object that includes:

- Session ID
- Task description
- Execution plan
- Step definitions
- Collected results
- Error tracking
- Token usage statistics

## Event Types

### Core Events

- `tool_start`: Tool execution beginning
- `tool_complete`: Tool execution completed
- `plan`: Planning phase complete
- `solve`: Solution phase complete
- `error`: Error occurred
- `completion`: AI completion received

### Event Context

Each event includes:

- Session ID
- Task description
- Step information
- Tool details
- Arguments
- State snapshot

## Error Handling

1. **Planning Errors**

   - Fallback to basic plan
   - Error event emission
   - State preservation

2. **Execution Errors**

   - Tool retry mechanism
   - Error context preservation
   - State recovery

3. **Solving Errors**
   - Graceful degradation
   - Partial solution generation
   - Error reporting

## Usage

```typescript
// Initialize ReWOO with configuration
const rewoo = new ReWOO(ai_config, tools);

// Execute a task
const result = await rewoo.execute('Your task here');

// Optional: Register callbacks for monitoring
rewoo.on('plan', (state) => {
  console.log('Plan created:', state.plan_string);
});

rewoo.on('tool_execute', (step, result) => {
  console.log(`Tool ${step.tool} executed:`, result);
});

rewoo.on('solve', (state) => {
  console.log('Solution found:', state.result);
});
```

## Best Practices

1. **Error Handling**

   - Always implement error callbacks
   - Use fallback mechanisms
   - Preserve error context

2. **State Management**

   - Keep state immutable
   - Use state snapshots
   - Track execution progress

3. **Event Cleanup**
   - Remove listeners when done
   - Clean up tool resources
   - Implement proper shutdown

## Configuration

The system supports configuration for:

- AI model selection
- API endpoints
- Temperature settings
- Tool-specific parameters
- Event handling preferences
