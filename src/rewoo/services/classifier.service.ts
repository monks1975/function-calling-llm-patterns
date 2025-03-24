// ~/src/ReWOO/services/classifier.service.ts

import { AiGenerate, type AiConfig } from '../ai';
import { PostgresDatabase } from '../db/postgres';
import { examples } from '../planner.examples';

import type { PlanExample } from '../types';

export class ClassifierService {
  private ai: AiGenerate;
  private db: PostgresDatabase;

  constructor(ai_config: AiConfig) {
    this.ai = new AiGenerate(ai_config);
    this.db = new PostgresDatabase();
    this.db.init().catch(console.error);
  }

  async initialize_examples(): Promise<void> {
    try {
      await this.db.pool.query(`
        CREATE TABLE IF NOT EXISTS example_tasks (
          id SERIAL PRIMARY KEY,
          task TEXT NOT NULL,
          required_tools TEXT[] NOT NULL,
          plan_steps TEXT[] NOT NULL,
          embedding VECTOR(1536),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert predefined examples if table is empty
      const { rows } = await this.db.pool.query(
        'SELECT COUNT(*) FROM example_tasks'
      );
      if (rows[0].count === '0') {
        await this.populate_examples(examples);
      }
    } catch (error) {
      console.error('Failed to initialize examples:', error);
      throw error;
    }
  }

  private async populate_examples(examples: PlanExample[]): Promise<void> {
    for (const example of examples) {
      const embedding = await this.ai.get_embedding(example.task);
      const formatted_embedding = `[${embedding.join(',')}]`;

      await this.db.pool.query(
        `INSERT INTO example_tasks(task, required_tools, plan_steps, embedding)
         VALUES($1, $2, $3, $4)`,
        [
          example.task,
          example.required_tools,
          example.plan_steps,
          formatted_embedding,
        ]
      );
    }
  }

  async classify_task(task: string, top_n: number = 5): Promise<PlanExample[]> {
    const embedding = await this.ai.get_embedding(task);
    const formatted_embedding = `[${embedding.join(',')}]`;

    const { rows } = await this.db.pool.query(
      `SELECT id, task, required_tools, plan_steps,
       (embedding <=> $1) AS distance
       FROM example_tasks
       ORDER BY distance ASC
       LIMIT $2`,
      [formatted_embedding, top_n]
    );

    return rows.map((row) => ({
      task: row.task,
      required_tools: row.required_tools,
      plan_steps: row.plan_steps,
      distance: row.distance,
    }));
  }

  // This method would be called manually or through an admin interface
  async add_example(example: PlanExample): Promise<void> {
    const embedding = await this.ai.get_embedding(example.task);
    const formatted_embedding = `[${embedding.join(',')}]`;

    await this.db.pool.query(
      `INSERT INTO example_tasks(task, required_tools, plan_steps, embedding)
       VALUES($1, $2, $3, $4)`,
      [
        example.task,
        example.required_tools,
        example.plan_steps,
        formatted_embedding,
      ]
    );
  }

  async cleanup(): Promise<void> {
    await this.db.cleanup();
  }
}
