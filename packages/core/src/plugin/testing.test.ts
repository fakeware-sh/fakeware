import { describe, expect, test } from 'bun:test'
import type { FakewarePlugin } from './define'
import { createCollectingLogSink, createTestPluginContext, runPluginHookOnce } from './testing'

describe('createTestPluginContext', () => {
  test('builds a context backed by the fake shop context', () => {
    const ctx = createTestPluginContext()
    expect(ctx.shopContext.index.currencyDefault.isoCode).toBe('EUR')
    expect(ctx.mode).toBe('test')
  })

  test('routes logger output to a collecting sink', () => {
    const sink = createCollectingLogSink()
    const ctx = createTestPluginContext({ name: 'demo', sink })
    ctx.logger.info('hello')
    ctx.logger.warn('careful')
    expect(sink.entries).toEqual([
      { plugin: 'demo', level: 'info', message: 'hello' },
      { plugin: 'demo', level: 'warn', message: 'careful' },
    ])
  })

  test('drops debug lines unless the sink opts in', () => {
    const quiet = createCollectingLogSink()
    createTestPluginContext({ name: 'd', sink: quiet }).logger.debug('x')
    expect(quiet.entries).toEqual([])

    const loud = createCollectingLogSink(true)
    createTestPluginContext({ name: 'd', sink: loud }).logger.debug('x')
    expect(loud.entries).toHaveLength(1)
  })
})

describe('runPluginHookOnce', () => {
  test('invokes a single hook with the given context', async () => {
    let seen: string | undefined
    const plugin: FakewarePlugin = {
      name: 'demo',
      hooks: {
        contextReady: ({ shopContext }) => {
          seen = shopContext.index.currencyDefault.isoCode
        },
      },
    }
    await runPluginHookOnce(plugin, 'contextReady', createTestPluginContext())
    expect(seen).toBe('EUR')
  })

  test('is a no-op when the plugin lacks the hook', async () => {
    const plugin: FakewarePlugin = { name: 'demo' }
    await expect(
      runPluginHookOnce(plugin, 'contextReady', createTestPluginContext()),
    ).resolves.toBeUndefined()
  })
})
