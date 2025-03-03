// ~/src/PlanExecute/tools/index.ts
export * from './base.tool';

export { calculator } from './calculator.tool';
export { google } from './google.tool';
export { llm } from './llm.tool';
export { wikipedia } from './wikipedia.tool';

import { DefaultToolRegistry } from '../tool.registry';

import { calculator } from './calculator.tool';
import { google } from './google.tool';
import { llm } from './llm.tool';
import { wikipedia } from './wikipedia.tool';

// Create and configure the tool registry
export function setup_tool_registry() {
  const registry = new DefaultToolRegistry();

  // Register all tools
  registry.register(calculator);
  registry.register(google);
  registry.register(llm);
  registry.register(wikipedia);

  return registry;
}
