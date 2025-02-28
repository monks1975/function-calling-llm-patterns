import { z } from 'zod';
import { handle_tool_error, ToolResponse } from './helpers';
import { zod_schema_to_text } from './helpers';

// Define the schema for the planner tool input
const planner_schema = z.object({
  question: z
    .string()
    .min(1)
    .describe('The original question or task the agent is trying to solve'),
  current_iteration: z.number().min(1).describe('The current iteration number'),
  max_iterations: z
    .number()
    .min(1)
    .describe('The maximum number of iterations allowed'),
  previous_actions: z
    .array(
      z.object({
        action: z.string(),
        input: z.union([z.record(z.any()), z.string()]),
        observation: z.string(),
      })
    )
    .optional()
    .default([]),
  previous_thoughts: z.array(z.string()).optional().default([]),
});

// Export the schema as text for the prompt
export const text_schema = zod_schema_to_text(planner_schema);

// The planner tool implementation
export const planner_tool = async (
  input: z.infer<typeof planner_schema>
): Promise<ToolResponse> => {
  try {
    // Validate the input
    const validated = planner_schema.parse(input);

    const {
      question,
      current_iteration,
      max_iterations,
      previous_actions,
      previous_thoughts,
    } = validated;

    // Calculate remaining iterations
    const remaining_iterations = max_iterations - current_iteration;

    // Extract key information from previous actions
    const action_summary =
      previous_actions && previous_actions.length > 0
        ? previous_actions
            .map(
              (action) =>
                `- Used ${action.action} with input: ${
                  typeof action.input === 'string'
                    ? action.input
                    : JSON.stringify(action.input)
                }`
            )
            .join('\n')
        : 'No previous actions taken.';

    // Extract key insights from previous thoughts
    const thought_summary =
      previous_thoughts && previous_thoughts.length > 0
        ? previous_thoughts.slice(-3).join('\n')
        : 'No previous thoughts recorded.';

    // Analyze progress
    let progress_assessment = '';
    if (previous_actions && previous_actions.length > 0) {
      // Simple heuristic: check if the last observation contains relevant information
      const last_observation =
        previous_actions[previous_actions.length - 1].observation;
      const relevance_score = calculateRelevanceScore(
        question,
        last_observation
      );

      if (relevance_score > 0.7) {
        progress_assessment =
          'You appear to be making good progress toward answering the question.';
      } else if (relevance_score > 0.4) {
        progress_assessment =
          'You are making some progress, but may need to refine your approach.';
      } else {
        progress_assessment =
          'You do not appear to be making significant progress toward answering the question.';
      }
    } else {
      progress_assessment =
        'You have not yet taken any actions to answer the question.';
    }

    // Generate recommendations based on remaining iterations and progress
    let recommendations = '';
    if (remaining_iterations <= 1) {
      recommendations =
        'You should provide a final answer with your best conclusion based on information gathered so far.';
    } else if (remaining_iterations <= 3) {
      recommendations =
        'You have limited iterations remaining. Focus on the most promising path to an answer.';
    } else {
      recommendations =
        'You have sufficient iterations remaining to explore multiple approaches if needed.';
    }

    // Construct the planning summary
    const planning_summary = `
PLANNING SUMMARY:

Original Question: "${question}"

Progress Assessment:
${progress_assessment}

Iteration Status:
- Current iteration: ${current_iteration}
- Maximum iterations: ${max_iterations}
- Remaining iterations: ${remaining_iterations}

Previous Actions Summary:
${action_summary}

Recent Thoughts:
${thought_summary}

Recommendations:
${recommendations}
`.trim();

    return { result: planning_summary };
  } catch (error) {
    return handle_tool_error(
      'Planner',
      'Failed to generate planning summary',
      error
    );
  }
};

// Helper function to calculate a simple relevance score between the question and observation
function calculateRelevanceScore(
  question: string,
  observation: string
): number {
  // Normalize text for comparison
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/);

  const questionWords = new Set(normalizeText(question));
  const observationWords = normalizeText(observation);

  // Count matching words
  let matchCount = 0;
  for (const word of observationWords) {
    if (questionWords.has(word) && word.length > 3) {
      // Only count meaningful words
      matchCount++;
    }
  }

  // Simple relevance score based on matching words
  return Math.min(1, matchCount / Math.max(5, questionWords.size * 0.5));
}
