// ~/src/ReACT/logger.ts
// use `cat /tmp/app-logs/debug.pipe | npx pino-pretty` in a separate terminal to view debug logs

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { pino } from 'pino';

// Create debug FIFO directory and path
const FIFO_DIR = '/tmp/app-logs';
const DEBUG_FIFO = `${FIFO_DIR}/debug.pipe`;

// Ensure directory exists
mkdirSync(FIFO_DIR, { recursive: true });

// Create FIFO if it doesn't exist
if (!existsSync(DEBUG_FIFO)) {
  execSync(`mkfifo ${DEBUG_FIFO}`);
}

// Main application logger (normal stdout)
const logger = pino({
  level: 'info',
});

// Debug logger that ONLY goes to separate shell
const debugLogger = pino({
  level: 'debug',
  transport: {
    target: 'pino/file',
    options: { destination: DEBUG_FIFO },
  },
});

// Helper function to log ONLY to debug shell
const debug = (obj: any, msg = '') => {
  debugLogger.debug(obj, msg);
};

export { logger, debug };
