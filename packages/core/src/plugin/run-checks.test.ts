import { describe, expect, test } from 'bun:test'
import { createTestCheckContext } from '../testing'
import type { CheckContext, CheckOutcome } from './check'
import { definePlugin, type FakewarePlugin } from './define'
import { countShopChecks, PluginCheckError, reportFailures, runPluginChecks } from './run-checks'

function contextFor(): CheckContext {
  return createTestCheckContext()
}

function pluginWith(name: string, outcome: CheckOutcome | undefined, needsShop = false) {
  return definePlugin({
    name,
    checks: [{ name: `${name} check`, needsShop, run: () => outcome }],
  })
}

async function run(plugins: FakewarePlugin[], shop = true) {
  return await runPluginChecks(plugins, contextFor, { shop })
}

describe('runPluginChecks', () => {
  test('reports a passing check when run returns nothing', async () => {
    const reports = await run([pluginWith('a', undefined)])
    expect(reports).toEqual([{ plugin: 'a', check: 'a check', level: 'ok', message: 'passed' }])
  })

  test('carries level, message and hint from the outcome', async () => {
    const reports = await run([
      pluginWith('a', { level: 'warn', message: 'old version', hint: 'update it' }),
    ])
    expect(reports[0]).toEqual({
      plugin: 'a',
      check: 'a check',
      level: 'warn',
      message: 'old version',
      hint: 'update it',
    })
  })

  test('runs checks in plugin registration order', async () => {
    const reports = await run([
      pluginWith('a', { level: 'ok', message: 'a' }),
      pluginWith('b', { level: 'ok', message: 'b' }),
    ])
    expect(reports.map((report) => report.plugin)).toEqual(['a', 'b'])
  })

  test('turns a throwing check into an attributed error report', async () => {
    const boom = definePlugin({
      name: 'boom',
      checks: [
        {
          name: 'explodes',
          run: () => {
            throw new Error('kaboom')
          },
        },
      ],
    })
    const reports = await run([boom, pluginWith('after', { level: 'ok', message: 'still ran' })])
    expect(reports[0]).toEqual({
      plugin: 'boom',
      check: 'explodes',
      level: 'error',
      message: 'kaboom',
    })
    expect(reports[1]?.plugin).toBe('after')
  })

  test('skips checks that need the shop when shop is false', async () => {
    let ran = false
    const plugin = definePlugin({
      name: 'online',
      checks: [
        {
          name: 'needs shop',
          needsShop: true,
          run: () => {
            ran = true
          },
        },
      ],
    })
    expect(await run([plugin], false)).toEqual([])
    expect(ran).toBe(false)
  })

  test('runs offline checks even when shop is false', async () => {
    const reports = await run([pluginWith('offline', { level: 'ok', message: 'fine' })], false)
    expect(reports).toHaveLength(1)
  })

  test('returns nothing for plugins without checks', async () => {
    expect(await run([definePlugin({ name: 'bare' })])).toEqual([])
  })
})

describe('reportFailures', () => {
  test('throws with one line per failing check', () => {
    const reports = [
      { plugin: 'a', check: 'one', level: 'error' as const, message: 'nope', hint: 'fix it' },
      { plugin: 'b', check: 'two', level: 'warn' as const, message: 'meh' },
    ]
    expect(() => reportFailures(reports)).toThrow(PluginCheckError)
    try {
      reportFailures(reports)
    } catch (error) {
      const failure = error as PluginCheckError
      expect(failure.reports).toHaveLength(1)
      expect(failure.message).toBe('Plugin "a" check "one" failed: nope fix it')
    }
  })

  test('does nothing when no check failed', () => {
    expect(() =>
      reportFailures([{ plugin: 'a', check: 'one', level: 'warn', message: 'meh' }]),
    ).not.toThrow()
  })
})

describe('countShopChecks', () => {
  test('counts only the checks that need the shop', () => {
    const plugin = definePlugin({
      name: 'mixed',
      checks: [
        { name: 'offline', run: () => undefined },
        { name: 'online', needsShop: true, run: () => undefined },
      ],
    })
    expect(countShopChecks([plugin, definePlugin({ name: 'bare' })])).toBe(1)
  })
})

describe('offlineClient', () => {
  test('throws when an offline check reaches for the shop', () => {
    const ctx = createTestCheckContext()
    expect(() => ctx.client.invoke).toThrow('needsShop')
  })
})
