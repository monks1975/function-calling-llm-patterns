// ~/src/ReWOO/ai.ts
// ReWOO-specific AI functionality

import { AiGenerate, AiConfig, AiError, ContentModerationError } from '../core';

export { AiConfig, AiError, ContentModerationError };

export class ReWOOAi extends AiGenerate {
  constructor(config: AiConfig) {
    super(config, undefined, 'planner');
  }
}
