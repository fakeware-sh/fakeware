import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findPlugins, type OfficialPlugin } from '../../lib/plugins'
import { cleanupPartial } from './execute'
import type { InitFlags } from './flags'
import { hasFullConnection, isNonInteractive, resolveExampleData, resolvePlugins } from './gather'
import { buildSummaryRows, initCommand } from './index'
import { outroFor } from './outro'

function flags(overrides: Partial<InitFlags> = {}): InitFlags {
  return {
    template: 'project',
    secrets: 'env',
    install: true,
    force: false,
    dryRun: false,
    ...overrides,
  }
}

function inputs(overrides: Partial<Parameters<typeof buildSummaryRows>[1]> = {}) {
  return {
    location: '.',
    packageManager: 'bun' as const,
    plugins: [] as OfficialPlugin[],
    exampleData: true,
    dirStrategy: 'fresh' as const,
    ...overrides,
  }
}

describe('isNonInteractive', () => {
  test('is non-interactive when there is no TTY', () => {
    expect(isNonInteractive(flags(), false)).toBe(true)
  })

  test('is interactive on a TTY with no forcing flags', () => {
    expect(isNonInteractive(flags(), true)).toBe(false)
  })

  test('--yes forces non-interactive even on a TTY', () => {
    expect(isNonInteractive(flags({ yes: true }), true)).toBe(true)
  })

  test('all three connection flags force non-interactive on a TTY', () => {
    const connected = flags({ url: 'https://s.test', clientId: 'i', clientSecret: 's' })
    expect(isNonInteractive(connected, true)).toBe(true)
  })

  test('a partial connection does not force non-interactive on a TTY', () => {
    expect(isNonInteractive(flags({ url: 'https://s.test' }), true)).toBe(false)
  })
})

describe('hasFullConnection', () => {
  test('needs all three credentials', () => {
    expect(hasFullConnection(flags({ url: 'https://s.test' }))).toBe(false)
    expect(hasFullConnection(flags({ url: 'https://s.test', clientId: 'i' }))).toBe(false)
    expect(
      hasFullConnection(flags({ url: 'https://s.test', clientId: 'i', clientSecret: 's' })),
    ).toBe(true)
  })
})

describe('resolvePlugins', () => {
  const fallback = async () => findPlugins(['pickware'])

  test('--no-plugins resolves to an empty list without calling the fallback', async () => {
    let called = false
    const result = await resolvePlugins(flags({ plugins: false }), async () => {
      called = true
      return []
    })
    expect(result).toEqual([])
    expect(called).toBe(false)
  })

  test('a plugin string is resolved via the flag parser', async () => {
    const result = await resolvePlugins(flags({ plugins: 'pickware' }), fallback)
    expect(result.map((p) => p.id)).toEqual(['pickware'])
  })

  test('"none" resolves to an empty list', async () => {
    const result = await resolvePlugins(flags({ plugins: 'none' }), fallback)
    expect(result).toEqual([])
  })

  test('falls back when no plugin flag is given', async () => {
    const result = await resolvePlugins(flags(), fallback)
    expect(result.map((p) => p.id)).toEqual(['pickware'])
  })
})

describe('resolveExampleData', () => {
  const yes = async () => true

  test('defaults to the prompt/fallback for a project', async () => {
    expect(await resolveExampleData(flags(), yes)).toBe(true)
  })

  test('--no-example-data opts out without calling the fallback', async () => {
    let called = false
    const result = await resolveExampleData(flags({ exampleData: false }), async () => {
      called = true
      return true
    })
    expect(result).toBe(false)
    expect(called).toBe(false)
  })

  test('honours a fallback that declines', async () => {
    expect(await resolveExampleData(flags(), async () => false)).toBe(false)
  })

  test('never scaffolds example data for a plugin template', async () => {
    let called = false
    const result = await resolveExampleData(flags({ template: 'plugin' }), async () => {
      called = true
      return true
    })
    expect(result).toBe(false)
    expect(called).toBe(false)
  })
})

describe('initCommand', () => {
  test('declares --template defaulting to project', () => {
    const template = initCommand().options.find((option) => option.long === '--template')
    expect(template).toBeDefined()
    expect(template?.defaultValue).toBe('project')
  })

  test('rejects an unknown template value at parse time', () => {
    const command = initCommand().exitOverride()
    expect(() => command.parse(['--template', 'nope'], { from: 'user' })).toThrow()
  })

  test('accepts the plugin template and exposes it as a flag value', () => {
    const command = initCommand().exitOverride()
    command.parseOptions(['--template', 'plugin'])
    expect(command.opts<InitFlags>().template).toBe('plugin')
  })

  test('defaults the template to project when the flag is absent', () => {
    const command = initCommand().exitOverride()
    command.parseOptions([])
    expect(command.opts<InitFlags>().template).toBe('project')
  })
})

describe('buildSummaryRows', () => {
  test('a project run summarises shop, plugins and secrets', () => {
    const rows = buildSummaryRows(flags(), inputs(), '/tmp/shop', 'shop')
    const labels = rows.map((row) => row.label)
    expect(labels).toContain('Shop')
    expect(labels).toContain('Plugins')
    expect(labels).toContain('Secrets')
    expect(rows.find((row) => row.label === 'Template')?.value).toBe('project')
    expect(rows.find((row) => row.label === 'Project')?.value).toBe('shop')
  })

  test('a plugin run omits the shop-only rows and labels the package', () => {
    const rows = buildSummaryRows(flags({ template: 'plugin' }), inputs(), '/tmp/pl', 'my-plugin')
    const labels = rows.map((row) => row.label)
    expect(labels).not.toContain('Shop')
    expect(labels).not.toContain('Plugins')
    expect(labels).not.toContain('Secrets')
    expect(rows.find((row) => row.label === 'Package')?.value).toBe('my-plugin')
  })
})

describe('outroFor', () => {
  test('a dry run reports the file count and writes nothing', () => {
    const out = outroFor(flags({ dryRun: true }), '/tmp/x', [
      { path: '/tmp/x/package.json', note: '' },
      { path: '/tmp/x/tsconfig.json', note: '' },
    ])
    expect(out).toContain('2 files')
    expect(out).toContain('Nothing was created')
  })

  test('a project run points at fakeware up', () => {
    expect(outroFor(flags(), process.cwd(), [], true)).toContain('fakeware up --dry-run')
  })

  test('opting out of example data tells the user to add a data file first', () => {
    const out = outroFor(flags(), process.cwd(), [], false)
    expect(out).toContain('data/')
    expect(out).not.toContain('fakeware up --dry-run')
  })

  test('a plugin run points at the plugin scripts, not fakeware up', () => {
    const out = outroFor(flags({ template: 'plugin' }), process.cwd(), [], false)
    expect(out).toContain('bun test')
    expect(out).toContain('bun run typecheck')
    expect(out).not.toContain('fakeware up')
  })
})

describe('cleanupPartial', () => {
  test('removes the files it was given and reports them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fw-cleanup-'))
    const path = join(dir, 'package.json')
    writeFileSync(path, '{}')

    const removed = await cleanupPartial([{ path, note: '' }])
    expect(removed).toEqual([path])
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('is a no-op for an empty list', async () => {
    expect(await cleanupPartial([])).toEqual([])
  })
})
