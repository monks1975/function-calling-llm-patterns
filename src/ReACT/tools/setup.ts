// ~/src/ReACT/tools/setup.ts

import * as path from 'path';

import {
  calculator_tool,
  text_schema as calculator_text_schema,
} from './calculator.tool';

import {
  search_web_tool,
  text_schema as search_web_text_schema,
} from './search.tool';

import { create_library_tool } from './library.tool';
import { load_and_convert_yaml } from '../helpers';

export interface ToolDefinition {
  name: string;
  alternative_names: string[];
  description: string;
  schema: string;
  execute: Function;
}

export interface ToolConfiguration {
  enabled: boolean;
  config?: Record<string, any>;
}

export type ToolsConfig = {
  [K in keyof typeof available_tools]?: ToolConfiguration;
};

interface ToolFactory<TConfig = void> {
  create: (config?: TConfig) => ToolDefinition;
  requires_config: boolean;
  required_config?: string[];
  examples?: string;
}

// Tool-specific configuration interfaces
interface LibraryToolConfig {
  library_uuid: string;
  library_name: string;
  library_description: string;
}

// Load example files
const calculator_examples = load_and_convert_yaml(
  path.join(__dirname, 'calculator.examples.yaml')
);

const search_web_examples = load_and_convert_yaml(
  path.join(__dirname, 'search.examples.yaml')
);

const library_examples = load_and_convert_yaml(
  path.join(__dirname, 'library.examples.yaml')
);

// Tool factory definitions
const calculator_factory: ToolFactory = {
  create: () => ({
    name: 'Calculator',
    alternative_names: ['Calculate', 'Math', 'Calculator Tool'],
    description: 'A tool for calculating mathematical expressions',
    schema: calculator_text_schema,
    execute: calculator_tool,
  }),
  requires_config: false,
  examples: calculator_examples,
};

const search_web_factory: ToolFactory = {
  create: () => ({
    name: 'Search Web',
    alternative_names: ['Google', 'Search', 'Search Internet', 'Search Tool'],
    description: 'A tool for searching the web',
    schema: search_web_text_schema,
    execute: search_web_tool,
  }),
  requires_config: false,
  examples: search_web_examples,
};

const library_factory: ToolFactory<LibraryToolConfig> = {
  create: (config) => {
    if (!config?.library_uuid) {
      throw new Error('library_uuid is required for library tool');
    }
    return create_library_tool(
      config.library_uuid,
      config.library_name,
      config.library_description
    );
  },
  requires_config: true,
  required_config: ['library_uuid', 'library_name', 'library_description'],
  examples: library_examples,
};

// Define available tools without instantiating them
export const available_tools = {
  calculator: calculator_factory,
  search_web: search_web_factory,
  library: library_factory,
} as const;

export function init_tools_from_config(config: ToolsConfig): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  for (const [tool_name, tool_config] of Object.entries(config)) {
    if (!tool_config?.enabled) continue;

    const tool_key = tool_name as keyof typeof available_tools;
    const tool_definition = available_tools[tool_key];

    if (!tool_definition) {
      throw new Error(`Tool "${tool_name}" not found in available tools`);
    }

    if (tool_definition.requires_config && !tool_config.config) {
      throw new Error(
        `Tool "${tool_name}" requires configuration but none was provided`
      );
    }

    try {
      // Type assertion here is safe because we've checked requires_config above
      const tool = (
        tool_definition as ToolFactory<typeof tool_config.config>
      ).create(
        tool_definition.requires_config ? tool_config.config : undefined
      );
      tools.push(tool);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to create tool "${tool_name}": ${error.message}`
        );
      }
      throw error;
    }
  }

  return tools;
}

export function get_tools_for_prompt(tools: ToolDefinition[]): string {
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

// get examples for enabled tools
export function get_tool_examples(config: ToolsConfig): string {
  const examples: string[] = [];

  for (const [tool_name, tool_config] of Object.entries(config)) {
    if (!tool_config?.enabled) continue;

    const tool_key = tool_name as keyof typeof available_tools;
    const tool_factory = available_tools[tool_key];

    if (tool_factory?.examples) {
      examples.push(tool_factory.examples);
    }
  }

  return examples.join('\n\n');
}
