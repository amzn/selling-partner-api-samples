import { config } from '../config/index.js';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const shouldLog = (level: string): boolean => {
  const configLevel = LOG_LEVELS[config.logLevel as keyof typeof LOG_LEVELS] || 2;
  const messageLevel = LOG_LEVELS[level as keyof typeof LOG_LEVELS] || 0;
  return messageLevel <= configLevel;
};

export const logger = {
  error: (message: string, ...args: any[]) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (shouldLog('warn')) {
      console.error(`[WARN] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (shouldLog('info')) {
      console.error(`[INFO] ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (shouldLog('debug')) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }
};
