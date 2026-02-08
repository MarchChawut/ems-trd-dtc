/**
 * ==================================================
 * Logger Service - ระบบบันทึก Log สำหรับ Production
 * ==================================================
 * แทนการใช้ console.log/console.error โดยตรง
 * รองรับการส่งไปยัง External Logging Service (Sentry, Loggly, etc.)
 * 
 * การใช้งาน:
 * import { logger } from '@/lib/logger';
 * logger.info('User logged in', { userId: 123 });
 * logger.error('Database connection failed', { error });
 */

// Log Levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  context?: {
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
  };
}

// Configuration
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LOG_SERVICE = process.env.LOG_SERVICE || 'console'; // 'console', 'sentry', 'loggly'
const LOG_SERVICE_URL = process.env.LOG_SERVICE_URL;
const LOG_SERVICE_KEY = process.env.LOG_SERVICE_KEY;

// Log level priority
const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * ตรวจสอบว่าควร log หรือไม่
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[LOG_LEVEL];
}

/**
 * ล้างข้อมูล sensitive ออกจาก log
 */
function sanitizeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  
  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'cookie', 'session'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * ส่ง log ไปยัง external service (async)
 */
async function sendToExternalService(entry: LogEntry): Promise<void> {
  if (LOG_SERVICE === 'console' || !LOG_SERVICE_URL) {
    return;
  }
  
  try {
    const response = await fetch(LOG_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOG_SERVICE_KEY || ''}`,
      },
      body: JSON.stringify(entry),
    });
    
    if (!response.ok) {
      // Fallback to console if external service fails
      console.error('Failed to send log to external service:', response.statusText);
    }
  } catch (error) {
    // Fallback to console if external service fails
    console.error('Failed to send log to external service:', error);
  }
}

/**
 * สร้าง log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  context?: LogEntry['context']
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: sanitizeData(data),
    context,
  };
}

/**
 * แสดง log ใน console (development mode)
 */
function logToConsole(entry: LogEntry): void {
  if (process.env.NODE_ENV === 'production') {
    // ใน production ใช้ JSON format สำหรับ parsing
    console.log(JSON.stringify(entry));
    return;
  }
  
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  };
  
  const reset = '\x1b[0m';
  const color = colors[entry.level];
  
  let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`;
  
  if (entry.data) {
    output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
  }
  
  if (entry.context) {
    output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
  }
  
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Logger Class
 */
class Logger {
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, context?: LogEntry['context']): void {
    if (!shouldLog(level)) {
      return;
    }
    
    const entry = createLogEntry(level, message, data, context);
    
    // Log to console (always)
    logToConsole(entry);
    
    // Send to external service (non-blocking)
    if (LOG_SERVICE !== 'console') {
      // Don't await - fire and forget
      sendToExternalService(entry).catch(() => {
        // Silently fail - already logged to console
      });
    }
  }
  
  debug(message: string, data?: Record<string, unknown>, context?: LogEntry['context']): void {
    this.log('debug', message, data, context);
  }
  
  info(message: string, data?: Record<string, unknown>, context?: LogEntry['context']): void {
    this.log('info', message, data, context);
  }
  
  warn(message: string, data?: Record<string, unknown>, context?: LogEntry['context']): void {
    this.log('warn', message, data, context);
  }
  
  error(message: string, data?: Record<string, unknown>, context?: LogEntry['context']): void {
    this.log('error', message, data, context);
  }
  
  /**
   * สร้าง logger ที่มี context คงที่
   */
  withContext(context: LogEntry['context']): Logger {
    const childLogger = new Logger();
    const originalLog = this.log.bind(this);
    
    childLogger['log'] = (level: LogLevel, message: string, data?: Record<string, unknown>, additionalContext?: LogEntry['context']) => {
      this.log(level, message, data, { ...context, ...additionalContext });
    };
    
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };
