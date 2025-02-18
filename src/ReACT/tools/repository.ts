// ~/src/REACT-COT/tools/repository.ts

import {
  calculator_tool,
  json_schema as calculator_json_schema,
} from './calculator';

import {
  search_web_tool,
  json_schema as search_web_json_schema,
} from './search';

export interface Tool {
  name: string;
  alternative_names: string[];
  description: string;
  schema: string;
  function: Function;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: string;
}

export const tool_repository: Record<string, Tool> = {
  calculator: {
    name: 'Calculator',
    alternative_names: ['Calc', 'Calculator Math', 'Math'],
    description: 'A tool for calculating mathematical expressions',
    schema: calculator_json_schema,
    function: calculator_tool,
  },
  search_web: {
    name: 'Search Web',
    alternative_names: ['Search', 'Search Internet'],
    description: 'A tool for searching the web',
    schema: search_web_json_schema,
    function: search_web_tool,
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

export function convert_tools_for_prompt(tools: Tool[]): string {
  return tools
    .map((tool) => {
      let toolDescription = `Tool: ${tool.name}\n`;
      toolDescription += `Description: ${tool.description}\n`;
      toolDescription += 'Input Schema:\n';
      toolDescription += tool.schema
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => `  ${line}`)
        .join('\n');
      return toolDescription;
    })
    .join('\n\n');
}
