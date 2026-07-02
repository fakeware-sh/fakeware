import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseModule } from 'magicast'
import type { OfficialPlugin } from '../plugins'
import { addToConfigFile, buildConfigFile } from './config-file'
import type { ScaffoldValues } from './values'

function configObject(source: string): Record<string, unknown> {
  return parseModule(source).exports.default.$args[0] as Record<string, unknown>
}

const pickware: OfficialPlugin = {
  id: 'pickware',
  packageName: '@fakeware/plugin-pickware',
  importName: 'pickware',
  version: '^1.1.0',
  label: 'Pickware',
  hint: 'ERP',
}

const other: OfficialPlugin = {
  id: 'other',
  packageName: '@fakeware/plugin-other',
  importName: 'other',
  version: '^2.0.0',
  label: 'Other',
  hint: 'Other',
}

const base: ScaffoldValues = {
  projectName: 'demo',
  secrets: 'env',
  plugins: [],
}

describe('buildConfigFile', () => {
  test('wraps defineConfig and imports from @fakeware/core/config', () => {
    const code = buildConfigFile(base)
    expect(code).toContain("import { defineConfig } from '@fakeware/core/config'")
    expect(code).toContain('defineConfig(')
    expect(code.endsWith('\n')).toBe(true)
  })

  test('emits an env-var shopware block in env mode', () => {
    const cfg = configObject(
      buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }),
    )
    const shopware = cfg.shopware as Record<string, unknown>
    expect(shopware.url).toBe('$SHOPWARE_URL')
    expect(shopware.clientId).toBe('$SHOPWARE_CLIENT_ID')
    expect(shopware.clientSecret).toBe('$SHOPWARE_CLIENT_SECRET')
  })

  test('embeds literal credentials in inline mode', () => {
    const cfg = configObject(
      buildConfigFile({
        ...base,
        secrets: 'inline',
        url: 'https://shop.test',
        clientId: 'id',
        clientSecret: 'secret',
      }),
    )
    expect((cfg.shopware as Record<string, unknown>).url).toBe('https://shop.test')
  })

  test('omits shopware when no connection is provided', () => {
    const cfg = configObject(buildConfigFile({ ...base }))
    expect(cfg.shopware).toBeUndefined()
    expect(Object.keys(cfg)).toEqual([])
  })

  test('output re-parses to a stable shape (magicast drift guard)', () => {
    const cfg = configObject(
      buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }),
    )
    expect(Object.keys(cfg)).toEqual(['shopware'])
  })

  test('injects a plugin factory call and named import (no connection)', () => {
    const code = buildConfigFile({ ...base, plugins: [pickware] })
    const mod = parseModule(code)
    expect(mod.imports.pickware?.from).toBe('@fakeware/plugin-pickware')
    const cfg = configObject(code)
    expect(Object.keys(cfg)).toEqual(['plugins'])
    const plugins = cfg.plugins as Array<Record<string, unknown>>
    expect(plugins).toHaveLength(1)
    expect(plugins[0]?.$type).toBe('function-call')
    expect(plugins[0]?.$callee).toBe('pickware')
  })

  test('keeps shopware before plugins when both are present', () => {
    const cfg = configObject(
      buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z', plugins: [pickware] }),
    )
    expect(Object.keys(cfg)).toEqual(['shopware', 'plugins'])
  })

  test('injects multiple plugins with one import each', () => {
    const code = buildConfigFile({ ...base, plugins: [pickware, other] })
    expect(code).toContain("from '@fakeware/plugin-pickware'")
    expect(code).toContain("from '@fakeware/plugin-other'")
    const cfg = configObject(code)
    const plugins = cfg.plugins as unknown[]
    expect(plugins).toHaveLength(2)
    const mod = parseModule(code)
    expect(mod.imports.pickware).toBeDefined()
    expect(mod.imports.other).toBeDefined()
  })

  test('omits plugins key when none selected', () => {
    const cfg = configObject(buildConfigFile({ ...base, plugins: [] }))
    expect(cfg.plugins).toBeUndefined()
  })
})

describe('addToConfigFile', () => {
  test('injects a key into an existing config without clobbering others', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fw-add-'))
    const path = join(dir, 'fakeware.config.ts')
    writeFileSync(path, buildConfigFile({ ...base, url: 'x', clientId: 'y', clientSecret: 'z' }))

    await addToConfigFile(path, (cfg) => {
      cfg.injected = 'abc'
    })

    const cfg = configObject(readFileSync(path, 'utf8'))
    expect(cfg.injected).toBe('abc')
    expect((cfg.shopware as Record<string, unknown>).url).toBe('$SHOPWARE_URL')
  })
})
