// ~/src/rewoo/services/memory_service.ts

import { v4 as uuid } from 'uuid';

import { PostgresDatabase } from '../db/postgres_database';

import { AiGenerate, type AiConfig } from '../ai';

export class MemoryService {
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

  async store_solution(
    session_id: string,
    task: string,
    solution: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      const embedding = await this.ai.get_embedding(task);
      const cleaned_solution = this.clean_solution_text(solution);
      const formatted_embedding = `[${embedding.join(',')}]`;
      const solution_id = uuid();

      await this.db.pool.query(
        `INSERT INTO solutions(id, session_id, task, solution, embedding, metadata)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [
          solution_id,
          session_id,
          task,
          cleaned_solution,
          formatted_embedding,
          JSON.stringify(metadata),
        ]
      );
    } catch (error) {
      console.error('Error storing solution:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.db.cleanup();
  }
}
