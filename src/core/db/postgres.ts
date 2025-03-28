// ~/src/core/db/postgres.ts
// Generic PostgreSQL database functionality

import { Pool } from 'pg';

export interface PostgresConfig {
  host?: string;
  database?: string;
  user?: string;
  password?: string;
  port?: number;
}

export class PostgresDatabase {
  public pool: Pool;

  constructor(config: PostgresConfig = {}) {
    this.pool = new Pool({
      host: config.host || process.env.POSTGRES_HOST || 'localhost',
      database: config.database || process.env.POSTGRES_DB || 'rewoo',
      user: config.user || process.env.POSTGRES_USER || 'postgres',
      password: config.password || process.env.POSTGRES_PASSWORD || 'postgres',
      port: config.port || parseInt(process.env.POSTGRES_PORT || '5432'),
    });
  }

  async init(): Promise<void> {
    try {
      await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}
