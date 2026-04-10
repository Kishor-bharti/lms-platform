import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'http');
const logsDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// ─── Custom log levels (extends winston defaults to add 'http') ───
const customLevels = {
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  colors: { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'cyan' },
};

winston.addColors(customLevels.colors);

// ─── Formats ──────────────────────────────────────────────────────
const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ─── Transports ───────────────────────────────────────────────────
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isDev ? devFormat : prodFormat,
  }),
];

if (!isDev) {
  // All logs (info and above) — primary log to grep for general events
  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '50m',
      level: 'info',
      format: prodFormat,
    }) as unknown as winston.transport
  );

  // Errors only — fastest way to spot critical failures
  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      level: 'error',
      format: prodFormat,
    }) as unknown as winston.transport
  );

  // Warnings — slow requests, RBAC denials, auth failures (easy to grep in production)
  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      level: 'warn',
      format: prodFormat,
    }) as unknown as winston.transport
  );

  // HTTP access log — every request/response for traffic analysis
  transports.push(
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      maxSize: '100m',
      level: 'http',
      format: prodFormat,
    }) as unknown as winston.transport
  );
}

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: logLevel,
  transports,
  exitOnError: false,
});

export default logger;
