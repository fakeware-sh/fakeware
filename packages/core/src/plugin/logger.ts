export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  plugin: string
  level: LogLevel
  message: string
}

export interface LogSink {
  write(entry: LogEntry): void
  debug?: boolean
}

export interface PluginLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export const consoleLogSink: LogSink = {
  debug: false,
  write({ plugin, level, message }) {
    const line = `[${plugin}] ${message}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  },
}

export const silentLogSink: LogSink = { debug: false, write() {} }

export function createPluginLogger(plugin: string, sink: LogSink = consoleLogSink): PluginLogger {
  const emit =
    (level: LogLevel) =>
    (message: string): void => {
      if (level === 'debug' && !sink.debug) return
      sink.write({ plugin, level, message })
    }
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  }
}
