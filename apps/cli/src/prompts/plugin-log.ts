import * as p from '@clack/prompts'
import type { LogSink } from '@fakeware/core'

export function pluginLogSink(debug = false): LogSink {
  return {
    debug,
    write({ plugin, level, message }) {
      const line = `[${plugin}] ${message}`
      if (level === 'error') p.log.error(line)
      else if (level === 'warn') p.log.warn(line)
      else p.log.info(line)
    },
  }
}
