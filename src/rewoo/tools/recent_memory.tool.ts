// ~/src/ReWOO/tools/recent_memory.tool.ts

import { PostgresDatabase } from '../db/postgres';

import type { Tool } from '../types';

export class RecentMemoryTool implements Tool {
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MAX_LIMIT = 20;

  name = 'RecentMemory';
  description =
    'Retrieves recent memories, optionally filtered by date range. Parameters:\n' +
    '- from_date: ISO format date to filter from\n' +
    '- to_date: ISO format date to filter to\n' +
    '- limit: Maximum number of records to return (default: 10, max: 20)';
  private db: PostgresDatabase;

  constructor() {
    this.db = new PostgresDatabase();
    this.db.init().catch(console.error);
  }

  async execute(args: string): Promise<string> {
    try {
      // Parse args as JSON to get optional parameters
      const params = args ? JSON.parse(args) : {};
      const {
        from_date,
        to_date,
        limit = RecentMemoryTool.DEFAULT_LIMIT,
      } = params;

      // Validate limit is a positive number
      const validated_limit = Math.max(
        1,
        Math.min(
          RecentMemoryTool.MAX_LIMIT,
          Number(limit) || RecentMemoryTool.DEFAULT_LIMIT
        )
      );

      let query = `
        SELECT id, session_id, task, solution, metadata, created_at
        FROM solutions
      `;
      const query_params: any[] = [];

      if (from_date || to_date) {
        const conditions: string[] = [];

        if (from_date) {
          conditions.push('created_at >= $' + (query_params.length + 1));
          query_params.push(from_date);
        }

        if (to_date) {
          conditions.push('created_at <= $' + (query_params.length + 1));
          query_params.push(to_date);
        }

        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (query_params.length + 1);
      query_params.push(validated_limit);

      const { rows } = await this.db.pool.query(query, query_params);

      if (rows.length === 0) {
        return 'No memories found for the specified criteria.';
      }

      return rows
        .map(
          (r) =>
            `[${new Date(r.created_at).toISOString()}] Task: ${
              r.task
            }\nSolution: ${r.solution}`
        )
        .join('\n\n');
    } catch (error) {
      console.error('Error fetching memories:', error);
      return `Error fetching memories: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  async cleanup(): Promise<void> {
    await this.db.cleanup();
  }
}
