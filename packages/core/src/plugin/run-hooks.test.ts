import { describe, expect, test } from 'bun:test'
import type { ConfigContext, FakewarePlugin } from './define'
import { createPluginLogger, silentLogSink } from './logger'
import { dispatchOnError, PluginError, runPluginHook, runPluginResultHook } from './run-hooks'

function ctxFor(plugin: FakewarePlugin): ConfigContext {
  return {
    config: { transaction: { onError: 'rollback', atomic: true } },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    projectRoot: '/tmp/p',
    mode: 'test',
    logger: createPluginLogger(plugin.name, silentLogSink),
  }
}

describe('runPluginHook', () => {
  test('runs the hook across plugins in array order', async () => {
    const order: string[] = []
    const plugin = (name: string): FakewarePlugin => ({
      name,
      hooks: {
        configResolved: () => {
          order.push(name)
        },
      },
    })
    await runPluginHook(
      [plugin('a'), plugin('b'), plugin('c')],
      'configResolved',
      'configResolved',
      ctxFor,
    )
    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('skips plugins that do not implement the hook', async () => {
    let ran = 0
    const plugins: FakewarePlugin[] = [
      { name: 'a' },
      {
        name: 'b',
        hooks: {
          configResolved: () => {
            ran++
          },
        },
      },
    ]
    await runPluginHook(plugins, 'configResolved', 'configResolved', ctxFor)
    expect(ran).toBe(1)
  })

  test('wraps a throwing hook as PluginError with plugin and phase', async () => {
    const plugins: FakewarePlugin[] = [
      {
        name: 'boom',
        hooks: {
          configResolved: () => {
            throw new Error('x')
          },
        },
      },
    ]
    const run = runPluginHook(plugins, 'configResolved', 'configResolved', ctxFor)
    await expect(run).rejects.toBeInstanceOf(PluginError)
    await expect(run).rejects.toMatchObject({ plugin: 'boom', phase: 'configResolved' })
  })

  test('dispatches onError to every plugin before rethrowing', async () => {
    const seen: string[] = []
    const plugins: FakewarePlugin[] = [
      {
        name: 'a',
        hooks: {
          onError: ({ phase }) => {
            seen.push(`a:${phase}`)
          },
        },
      },
      {
        name: 'b',
        hooks: {
          configResolved: () => {
            throw new Error('x')
          },
        },
      },
    ]
    await expect(
      runPluginHook(plugins, 'configResolved', 'configResolved', ctxFor),
    ).rejects.toBeInstanceOf(PluginError)
    expect(seen).toEqual(['a:configResolved'])
  })
})

describe('runPluginResultHook', () => {
  test('merges the result into each plugin context', async () => {
    const seen: unknown[] = []
    const plugins: FakewarePlugin[] = [
      {
        name: 'a',
        hooks: {
          afterApply: ({ result }) => {
            seen.push(result)
          },
        },
      },
    ]
    const result = { mode: 'noop' }
    await runPluginResultHook(plugins, 'afterApply', 'afterApply', ctxFor, result)
    expect(seen).toEqual([result])
  })
})

describe('dispatchOnError', () => {
  test('swallows secondary errors thrown inside onError', async () => {
    const plugins: FakewarePlugin[] = [
      {
        name: 'a',
        hooks: {
          onError: () => {
            throw new Error('secondary')
          },
        },
      },
    ]
    await expect(
      dispatchOnError(plugins, 'contextReady', new Error('primary'), ctxFor),
    ).resolves.toBeUndefined()
  })
})
