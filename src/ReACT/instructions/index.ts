// ~/src/REACT-COT/instructions/index.ts

import { base_examples } from './base-examples';
import { ToolDefinition } from '../tools/repository';

export interface PromptConfig {
  include_date?: boolean;
  custom_instructions?: string[];
}

export function build_tool_section(tools: ToolDefinition[]): string {
  let toolText = 'You have access to these tools:\n\n';

  tools.forEach((tool, index) => {
    toolText += `${index + 1}. ${tool.name}\n`;
    toolText += `${tool.description}\n\n`;
    toolText += 'Examples:\n\n';

    // If this is the last tool
    if (index === tools.length - 1) {
      // For the last tool, handle its examples differently
      tool.examples.slice(0, -1).forEach((example) => {
        toolText += `${example}\n\n`;
      });
      // Add the last example without any newlines
      if (tool.examples.length > 0) {
        toolText += `${tool.examples[tool.examples.length - 1]}`;
      }
    } else {
      // For all other tools, keep double newlines after all examples
      tool.examples.forEach((example) => {
        toolText += `${example}\n\n`;
      });
    }
  });

  return toolText;
}

export function generate_system_prompt(
  tools: ToolDefinition[],
  config: PromptConfig = {}
): string {
  const basePrompt = [
    'You are a helpful AI assistant that follows the ReAct (Reasoning + Acting) framework to solve problems step by step.',

    config.include_date
      ? `Today's date is ${new Date().toLocaleDateString()}.`
      : '',

    'For each step, you should:',
    '1. Think about what information you need',
    '2. Choose an action if needed',
    '3. Wait for the observation',
    '4. Continue until you reach a final answer',

    'Here are examples of how to follow the ReACT framework:',

    ...base_examples.map((example) => `${example}`),

    build_tool_section(tools),

    'Remember:',
    "1. Always end with <HALT> to indicate you're ready for the next step",
    '2. Include "Thought:" before your reasoning',
    '3. Include "Action:" and "Action Input:" when using tools',
    '4. Only provide "Final Answer:" when you have all needed information',
    '5. Always format Action Input as valid JSON',
    '6. Wait for an Observation before proceeding using the <HALT> tag',
    '7. Keep thoughts clear and focused on the current step',

    ...(config.custom_instructions || []),

    'Begin each response with "Thought:" and follow the ReAct format strictly and without deviation.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return basePrompt;
}
