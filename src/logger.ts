import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// Handle both ESM and bundled executable environments
function getDirname(): string {
  if ('pkg' in process && (process as any).pkg !== undefined) {
    return path.dirname(process.execPath);
  }
  try {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch {
    return __dirname || process.cwd();
  }
}

const appDir = getDirname();

export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'screensaver' },
  transports: [
    new winston.transports.File({
      filename: (() => {
        if ('pkg' in process && (process as any).pkg !== undefined) {
          return path.join(path.dirname(process.execPath), 'error.log');
        }
        return path.join(appDir, '..', 'error.log');
      })(),
      level: 'error',
    }),
    new winston.transports.File({
      filename: (() => {
        if ('pkg' in process && (process as any).pkg !== undefined) {
          return path.join(path.dirname(process.execPath), 'combined.log');
        }
        return path.join(appDir, '..', 'combined.log');
      })(),
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

