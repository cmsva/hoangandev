/**
 * Lightweight logger — vanilla, no dependencies.
 * In dev: pretty console output with colors.
 * In prod: structured JSON for log aggregation.
 */

type LogLevel = "debug" | "info" | "warn" | "error"

const isProd = process.env.NODE_ENV === "production"

interface LogContext {
  module?: string
  userId?: string
  action?: string
  [key: string]: unknown
}

function format(level: LogLevel, message: string, context?: LogContext): string {
  if (isProd) {
    return JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...context,
    })
  }
  const ts = new Date().toISOString().slice(11, 23)
  const ctx = context ? ` ${JSON.stringify(context)}` : ""
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${ctx}`
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const line = format(level, message, context)
  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (!isProd) emit("debug", message, context)
  },
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, errOrContext?: Error | LogContext, context?: LogContext) => {
    if (errOrContext instanceof Error) {
      emit("error", message, {
        ...context,
        error: errOrContext.message,
        stack: isProd ? undefined : errOrContext.stack,
      })
    } else {
      emit("error", message, errOrContext)
    }
  },
}
