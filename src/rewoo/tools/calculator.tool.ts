// ~/src/ReWOO/tools/calculator.tool.ts
// TODO: Implement this tool

import { Tool } from '../types';

export class CalculatorTool implements Tool {
  name = 'Calculator';
  description = 'A tool for performing calculations';

  async execute(args: string): Promise<string> {
    return 'Calculator tool executed';
  }
}
