import { describe, expect, test } from 'bun:test'
import { createPluginLogger, type LogEntry, type LogSink } from './logger'

function collectingSink(debug: boolean): { sink: LogSink; entries: LogEntry[] } {
  const entries: LogEntry[] = []
  return {
    entries,
    sink: {
      debug,
      write(entry) {
        entries.push(entry)
      },
    },
  }
}

describe('createPluginLogger', () => {
  test('tags every entry with the plugin name and level', () => {
    const { sink, entries } = collectingSink(false)
    const logger = createPluginLogger('pickware', sink)
    logger.info('hello')
    logger.warn('careful')
    logger.error('boom')
    expect(entries).toEqual([
      { plugin: 'pickware', level: 'info', message: 'hello' },
      { plugin: 'pickware', level: 'warn', message: 'careful' },
      { plugin: 'pickware', level: 'error', message: 'boom' },
    ])
  })

  test('drops debug entries when the sink has debug disabled', () => {
    const { sink, entries } = collectingSink(false)
    createPluginLogger('pickware', sink).debug('noisy')
    expect(entries).toEqual([])
  })

  test('emits debug entries when the sink opts in', () => {
    const { sink, entries } = collectingSink(true)
    createPluginLogger('pickware', sink).debug('noisy')
    expect(entries).toEqual([{ plugin: 'pickware', level: 'debug', message: 'noisy' }])
  })
})
