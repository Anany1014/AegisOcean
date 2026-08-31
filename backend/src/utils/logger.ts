export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

class StructuredLogger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  public forContext(context: string): StructuredLogger {
    return new StructuredLogger(context);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.context ? { context: this.context } : {}),
      ...(metadata ? { metadata } : {})
    };

    const formatted = `[${entry.timestamp}] [${entry.level}]${entry.context ? ` [${entry.context}]` : ''} ${entry.message}`;
    
    if (level === LogLevel.ERROR) {
      console.error(formatted, metadata ? JSON.stringify(metadata, null, 2) : '');
    } else if (level === LogLevel.WARN) {
      console.warn(formatted, metadata ? JSON.stringify(metadata, null, 2) : '');
    } else {
      console.log(formatted, metadata ? JSON.stringify(metadata, null, 2) : '');
    }
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log(LogLevel.DEBUG, message, metadata);
    }
  }
}

export const logger = new StructuredLogger('AegisOcean');
