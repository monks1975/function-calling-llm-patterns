// Example of proper ReActAgent usage in a REST API context
// This pattern ensures proper cleanup to prevent memory leaks

import { ReActAgent } from '../react.agent';
import type { AiConfig } from '../ai';
import type { ToolsConfig } from '../tools/setup';

// Configuration for the agent (would typically come from environment variables)
const ai_config: AiConfig = {
  api_key: process.env.OPENAI_API_KEY || '',
  model: process.env.MODEL_NAME || 'gpt-4',
  // Add other configuration as needed
};

// Tool configuration (would typically be loaded from a config file)
const tools_config: ToolsConfig = {
  // Configure your tools here
};

/**
 * Creates a new ReActAgent instance for a single request
 * @returns A configured ReActAgent instance
 */
function create_agent() {
  return new ReActAgent(ai_config, tools_config);
}

/**
 * Example handler function for a REST API endpoint
 * This demonstrates proper agent lifecycle management
 */
async function handleQuestionRequest(question: string) {
  if (!question) {
    throw new Error('Question is required');
  }

  // Create a new agent instance for this request
  const agent = create_agent();

  try {
    // Set up event listeners for streaming (if needed)
    const chunks: string[] = [];

    agent.on('chunk', (chunk) => {
      chunks.push(chunk);
      // For streaming responses, you could send chunks to the client here
    });

    // Process the question
    const answer = await agent.answer(question);

    // Return the response
    return { answer };
  } catch (error) {
    console.error('Error processing question:', error);
    throw error;
  } finally {
    // CRITICAL: Always clean up the agent when done
    agent.cleanup();
    console.log('Agent cleaned up after request');
  }
}

/**
 * Example handler function with content moderation
 */
async function handleQuestionWithModeration(question: string) {
  if (!question) {
    throw new Error('Question is required');
  }

  // Create a new agent instance for this request
  const agent = create_agent();

  try {
    // Track if content was flagged
    let content_flagged = false;
    let flagged_categories: string[] = [];

    // Set up content moderation listener
    agent.on('content-moderation', (data) => {
      content_flagged = true;
      flagged_categories = data.violated_categories;

      // Log moderation events for monitoring
      console.log('Content moderation triggered:', {
        categories: data.violated_categories,
        original_message: data.original_message,
      });
    });

    // Process the question
    const answer = await agent.answer(question);

    // Return the response with moderation info if applicable
    return {
      answer,
      moderation: content_flagged
        ? {
            flagged: true,
            categories: flagged_categories,
          }
        : undefined,
    };
  } catch (error) {
    console.error('Error processing question:', error);
    throw error;
  } finally {
    // CRITICAL: Always clean up the agent when done
    agent.cleanup();
    console.log('Agent cleaned up after request');
  }
}

/**
 * Example of how to use these handlers in an Express app:
 *
 * ```typescript
 * import express from 'express';
 * const app = express();
 * app.use(express.json());
 *
 * app.post('/api/ask', async (req, res) => {
 *   try {
 *     const result = await handleQuestionRequest(req.body.question);
 *     res.json(result);
 *   } catch (error) {
 *     res.status(500).json({
 *       error: 'An error occurred',
 *       details: error instanceof Error ? error.message : String(error)
 *     });
 *   }
 * });
 *
 * app.post('/api/ask-with-moderation', async (req, res) => {
 *   try {
 *     const result = await handleQuestionWithModeration(req.body.question);
 *     res.json(result);
 *   } catch (error) {
 *     res.status(500).json({
 *       error: 'An error occurred',
 *       details: error instanceof Error ? error.message : String(error)
 *     });
 *   }
 * });
 * ```
 */

/**
 * IMPORTANT NOTES:
 *
 * 1. Each request creates a new ReActAgent instance
 * 2. The cleanup() method is ALWAYS called in a finally block
 * 3. Event listeners are attached only for the duration of the request
 * 4. No global/shared agent instances are used across requests
 *
 * This pattern ensures that:
 * - Memory is properly released after each request
 * - Event listeners don't accumulate
 * - Each request is isolated from others
 */

// Example usage (for testing)
async function test_agent() {
  try {
    const result = await handleQuestionRequest(
      "What's the weather like today?"
    );
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to test
// test_agent();
