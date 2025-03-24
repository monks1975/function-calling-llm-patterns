// ~/src/ReWOO/tools/recent_memory.tool.ts

import { z } from 'zod';
import { PostgresDatabase } from '../db/postgres';

import type { Tool } from '../types';

const memory_params_schema = z
  .object({
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
  })
  .strict();

type MemoryParams = z.infer<typeof memory_params_schema>;

export class RecentMemoryTool implements Tool {
  private static readonly MAX_LIMIT = 5;

  name = 'RecentMemory';
  description =
    'Retrieves recent memories, optionally filtered by a date range.';

  private db: PostgresDatabase;

  constructor() {
    this.db = new PostgresDatabase();
    this.db.init().catch(console.error);
  }

  async execute(args: string): Promise<string> {
    try {
      // Parse and validate args
      const params: MemoryParams = args
        ? memory_params_schema.parse(JSON.parse(args))
        : memory_params_schema.parse({});

      let query = `
        SELECT id, session_id, task, solution, metadata, created_at
        FROM solutions
      `;
      const query_params: any[] = [];

      if (params.from_date || params.to_date) {
        const conditions: string[] = [];

        if (params.from_date) {
          conditions.push('created_at >= $' + (query_params.length + 1));
          query_params.push(params.from_date);
        }

        if (params.to_date) {
          conditions.push('created_at <= $' + (query_params.length + 1));
          query_params.push(params.to_date);
        }

        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (query_params.length + 1);
      query_params.push(RecentMemoryTool.MAX_LIMIT);

      const { rows } = await this.db.pool.query(query, query_params);

      if (rows.length === 0) {
        return 'No memories found for the specified criteria.';
      }

      return rows
        .map(
          (r) =>
            `### Memory from ${new Date(r.created_at).toISOString()}\n\n` +
            `**Task:** ${r.task}\n\n` +
            `**Solution:**\n${r.solution}`
        )
        .join('\n\n---\n\n');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return `Error: Validation error: ${error.errors
          .map((e) => e.message)
          .join(', ')}`;
      }

      if (error instanceof SyntaxError) {
        return 'Error: Invalid JSON format in arguments';
      }

      console.error('Error fetching memories:', error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async cleanup(): Promise<void> {
    await this.db.cleanup();
  }
}
