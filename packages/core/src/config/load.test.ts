import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigError } from './errors'
import { interpolate } from './interpolate'
import { loadConfig } from './load'

describe('interpolate', () => {
  const env = { SHOPWARE_URL: 'https://shop.test' }

  test('replaces an exact $VAR string', () => {
    expect(interpolate('$SHOPWARE_URL', env)).toBe('https://shop.test')
  })

  test('recurses through objects and arrays', () => {
    expect(interpolate({ a: ['$SHOPWARE_URL'] }, env)).toEqual({ a: ['https://shop.test'] })
  })

  test('leaves non-matching strings untouched', () => {
    expect(interpolate('plain', env)).toBe('plain')
    expect(interpolate('prefix-$SHOPWARE_URL', env)).toBe('prefix-$SHOPWARE_URL')
  })

  test('leaves non-string scalars untouched', () => {
    expect(interpolate({ n: 1, b: true, z: null }, env)).toEqual({ n: 1, b: true, z: null })
  })

  test('throws on an undefined variable', () => {
    expect(() => interpolate('$MISSING', env)).toThrow(ConfigError)
  })
})

describe('loadConfig', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-cfg-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function writeConfig(body: string, env?: string): Promise<void> {
    await writeFile(join(dir, 'fakeware.config.ts'), body)
    if (env !== undefined) await writeFile(join(dir, '.env'), env)
  }

  test('loads an object config and resolves the connection', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig({ shopware: { url: 'https://a.test', clientId: 'i', clientSecret: 's' } })\n`,
    )
    const loaded = await loadConfig({ cwd: dir })
    expect(loaded.connection.url).toBe('https://a.test')
    expect(loaded.projectRoot).toBe(dir)
  })

  test('interpolates $ENV vars from .env', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig({ shopware: { url: '$SHOPWARE_URL', clientId: '$SW_ID', clientSecret: '$SW_SECRET' } })\n`,
      'SHOPWARE_URL=https://env.test\nSW_ID=id\nSW_SECRET=secret\n',
    )
    const loaded = await loadConfig({ cwd: dir })
    expect(loaded.connection.url).toBe('https://env.test')
    expect(loaded.connection.clientId).toBe('id')
  })

  test('supports the function form with env + mode', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig(({ env, mode }) => ({ shopware: { url: env.U ?? mode, clientId: 'i', clientSecret: 's' } }))\n`,
      'U=https://fn.test\n',
    )
    const loaded = await loadConfig({ cwd: dir })
    expect(loaded.connection.url).toBe('https://fn.test')
  })

  test('throws ConfigError when a referenced env var is missing', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig({ shopware: { url: '$NOPE', clientId: 'i', clientSecret: 's' } })\n`,
    )
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError)
  })

  test('throws ConfigError when shopware is absent', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig({})\n`,
    )
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError)
  })

  test('throws ConfigError when no config file is found', async () => {
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError)
  })

  test('carries plugins through with their functions intact', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `const plugin = {\n` +
        `  name: 'demo',\n` +
        `  fetchers: [{ entity: 'warehouses', fetch: async () => ({ data: [{ id: 'wh-1' }] }), merge: () => {} }],\n` +
        `  hooks: { contextReady: async () => {} },\n` +
        `}\n` +
        `export default defineConfig({ shopware: { url: 'https://a.test', clientId: 'i', clientSecret: 's' }, plugins: [plugin] })\n`,
    )
    const loaded = await loadConfig({ cwd: dir })
    expect(loaded.plugins).toHaveLength(1)
    expect(loaded.plugins[0]?.name).toBe('demo')
    expect(typeof loaded.plugins[0]?.hooks?.contextReady).toBe('function')
    const fetcher = loaded.plugins[0]?.fetchers?.[0]
    expect(typeof fetcher?.fetch).toBe('function')
    expect(await fetcher?.fetch({} as never)).toEqual({ data: [{ id: 'wh-1' }] })
  })

  test('defaults plugins to an empty array when none are configured', async () => {
    await writeConfig(
      `import { defineConfig } from '${join(import.meta.dir, 'index.ts')}'\n` +
        `export default defineConfig({ shopware: { url: 'https://a.test', clientId: 'i', clientSecret: 's' } })\n`,
    )
    const loaded = await loadConfig({ cwd: dir })
    expect(loaded.plugins).toEqual([])
  })
})
