// ~/src/ReAct/moderation.ts

import OpenAI from 'openai';

import type { Moderation } from 'openai/resources/moderations';

interface ModerationConfig {
  api_key: string;
}

export interface ModerationResult {
  flagged: boolean;
  categories: Moderation.Categories;
  category_scores: Moderation.CategoryScores;
}

export class Moderator {
  private openai: OpenAI;

  constructor(config: ModerationConfig) {
    this.openai = new OpenAI({
      apiKey: config.api_key,
    });
  }

  /**
   * Moderates the given text using OpenAI's moderation API
   * @param text The text to moderate
   * @returns A ModerationResult object containing the moderation results
   */
  async moderate(text: string): Promise<ModerationResult> {
    try {
      const response = await this.openai.moderations.create({
        model: 'omni-moderation-latest',
        input: text,
      });

      const result = response.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories,
        category_scores: result.category_scores,
      };
    } catch (error) {
      console.error('Moderation API error:', error);
      // In case of API error, we don't block the content
      // but we log the error and return a non-flagged result
      return {
        flagged: false,
        categories: {} as Moderation.Categories,
        category_scores: {} as Moderation.CategoryScores,
      };
    }
  }
}
