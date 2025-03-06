// ~/src/rewoo/tools/memory_by_keyword.tool.ts

import { AiGenerate, type AiConfig } from '../ai';
import { PostgresDatabase } from '../db/postgres_database';

import type { Tool } from '../types';

export class MemoryByKeywordTool implements Tool {
  name = 'MemoryByKeyword';
  description =
    'Retrieves memories related to the given query using semantic search.';
  private ai: AiGenerate;
  private db: PostgresDatabase;

  constructor(ai_config: AiConfig) {
    this.ai = new AiGenerate(ai_config);
    this.db = new PostgresDatabase();
    this.db.init().catch(console.error);
  }

  private clean_solution_text(text: string): string {
    return text.replace(/#E\d+|#[A-Za-z0-9_]+|\(#[A-Za-z0-9_]+\)/g, '');
  }

  async execute(args: string): Promise<string> {
    try {
      // Split terms and clean them
      const terms = args.split(',').map((term) => term.trim());

      // Get embeddings for each term
      const embeddings = await Promise.all(
        terms.map((term) => this.ai.get_embedding(term))
      );

      // Combine results from all terms
      const results = new Map();

      for (const embedding of embeddings) {
        const { rows } = await this.db.pool.query(
          `SELECT id, session_id, task, solution, metadata, 
           (embedding <=> $1) AS similarity
           FROM solutions
           WHERE (embedding <=> $1) < 2
           ORDER BY similarity ASC
           LIMIT 5`,
          [`[${embedding.join(',')}]`]
        );

        // Merge results, keeping best similarity score
        for (const row of rows) {
          const existing = results.get(row.id);
          if (!existing || existing.similarity > row.similarity) {
            results.set(row.id, row);
          }
        }
      }

      if (results.size === 0) {
        return 'No relevant memories found.';
      }

      return Array.from(results.values())
        .sort((a, b) => a.similarity - b.similarity)
        .slice(0, 5)
        .map(
          (r) =>
            `[Similarity: ${(1 - r.similarity).toFixed(2)}] Task: ${
              r.task
            }\nSolution: ${r.solution}\nSession: ${r.session_id}`
        )
        .join('\n\n');
    } catch (error) {
      console.error('Error searching memories:', error);
      return `Error searching memories: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  async cleanup(): Promise<void> {
    await this.db.cleanup();
  }
}
