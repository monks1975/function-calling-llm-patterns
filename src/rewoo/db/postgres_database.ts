// ~/src/ReWOO/db/postgres_database.ts

import { Pool } from 'pg';

export class PostgresDatabase {
  public pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB || 'rewoo',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
    });
  }

  async init(): Promise<void> {
    try {
      await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS solutions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          task TEXT NOT NULL,
          solution TEXT NOT NULL,
          embedding VECTOR(1536),
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}
