// ~/src/REACT-COT/tools/repository.ts

import {
  calculator_tool,
  json_schema as calculator_json_schema,
  examples as calculator_examples,
} from './calculator';

import {
  search_web_tool,
  json_schema as search_web_json_schema,
  examples as search_web_examples,
} from './search';

export interface Tool {
  name: string;
  alternative_names: string[];
  description: string;
  schema: string;
  function: Function;
  examples: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: string;
  examples: string[];
}

export const tool_repository: Record<string, Tool> = {
  calculator: {
    name: 'Calculator',
    alternative_names: ['Calc', 'Calculator_Tool'],
    description: 'A tool for calculating mathematical expressions',
    schema: calculator_json_schema,
    function: calculator_tool,
    examples: calculator_examples,
  },
  search_web: {
    name: 'Search Web',
    alternative_names: ['Search', 'Search_Tool'],
    description: 'A tool for searching the web',
    schema: search_web_json_schema,
    function: search_web_tool,
    examples: search_web_examples,
  },
};

export function get_tools_by_names(tool_names: string[]): Tool[] {
  return tool_names.map((name) => {
    const tool = tool_repository[name];
    if (!tool) {
      throw new Error(`Tool "${name}" not found in repository`);
    }
    return tool;
  });
}

export function convert_tools_for_prompt(tools: Tool[]): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    examples: tool.examples,
  }));
}
