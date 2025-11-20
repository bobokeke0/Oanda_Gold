/**
 * Winston Logger Configuration
 * Provides structured logging with file and console output
 */
import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import Config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = dirname(Config.LOG_FILE_PATH);
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create transports array
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: Config.LOG_LEVEL
  })
];

// Add file transport if enabled
if (Config.LOG_TO_FILE) {
  transports.push(
    new winston.transports.File({
      filename: Config.LOG_FILE_PATH,
      format: fileFormat,
      level: Config.LOG_LEVEL,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Separate error log
  transports.push(
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      format: fileFormat,
      level: 'error',
      maxsize: 10485760,
      maxFiles: 3,
      tailable: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: Config.LOG_LEVEL,
  format: fileFormat,
  transports,
  exitOnError: false
});

// Add custom methods for trading-specific logging
logger.trade = function(action, details) {
  this.info(`[TRADE] ${action}`, details);
};

logger.strategy = function(message, details = {}) {
  this.info(`[STRATEGY] ${message}`, details);
};

logger.risk = function(message, details = {}) {
  this.warn(`[RISK] ${message}`, details);
};

export default logger;
