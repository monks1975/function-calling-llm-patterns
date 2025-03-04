import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
}

export class Logger {
  private session_id: string;
  private logs: LogEntry[] = [];
  private log_dir: string;

  constructor() {
    this.session_id = new Date().toISOString().replace(/[:.]/g, '-');
    this.log_dir = join(process.cwd(), 'src', 'PlanExecute', 'logs');
  }

  async init(): Promise<void> {
    await mkdir(this.log_dir, { recursive: true });
  }

  add(level: LogLevel, message: string, data?: any): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
  }

  private format_log_entry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level_str = entry.level.toUpperCase().padEnd(5);
    let log_str = `${timestamp} ${level_str} ${entry.message}\n`;

    if (entry.data) {
      const formatted_data = this.format_data(entry.data)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      log_str += `${formatted_data}\n`;
    }

    return log_str;
  }

  private format_data(data: any): string {
    if (data == null) return String(data);

    if (typeof data === 'string') {
      return data
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\t/g, '\t');
    }

    if (typeof data === 'object') {
      return JSON.stringify(
        data,
        (_, value) => {
          if (typeof value === 'string') {
            return value
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '\t');
          }
          return value;
        },
        2
      );
    }

    return String(data);
  }

  async save(): Promise<string> {
    const log_path = join(this.log_dir, `${this.session_id}.log`);
    const log_content = this.logs
      .map((entry) => this.format_log_entry(entry))
      .join('\n');
    await writeFile(log_path, log_content);
    return log_path;
  }
}
