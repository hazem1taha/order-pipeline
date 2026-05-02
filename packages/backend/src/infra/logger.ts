export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  orderId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, extra: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
}

export function createLogger(context?: {
  correlationId?: string;
  orderId?: string;
  tenantId?: string;
}): Logger {
  const ctx = {
    correlationId: context?.correlationId ?? crypto.randomUUID(),
    orderId: context?.orderId,
    tenantId: context?.tenantId,
  };

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const entry = formatLog(level, message, { ...ctx, ...meta });
    console.log(JSON.stringify(entry));
  };

  return {
    debug: (message, meta) => log('DEBUG', message, meta),
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta),
  };
}
