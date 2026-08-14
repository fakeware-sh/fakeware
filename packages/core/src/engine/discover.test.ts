import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { discoverDataFiles } from './discover'

describe('discoverDataFiles', () => {
  let dir: string

  const loadedFor = (include: string[]): LoadedConfig =>
    ({
      config: { include },
      connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
      configPath: join(dir, 'fakeware.config.ts'),
      projectRoot: dir,
      plugins: [],
    }) as LoadedConfig

  const discover = (...include: string[]) => discoverDataFiles(loadedFor(include))

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-discover-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function write(...paths: string[]): Promise<void> {
    for (const path of paths) {
      const full = join(dir, path)
      await mkdir(join(full, '..'), { recursive: true })
      await writeFile(full, '')
    }
  }

  test('returns an empty list when nothing matches', async () => {
    expect(await discover('./data/**/*.ts')).toEqual([])
  })

  test('lists matches sorted, skipping tests and declarations', async () => {
    await write(
      'data/b.ts',
      'data/a.ts',
      'data/a.test.ts',
      'data/types.d.ts',
      'data/nested/c.ts',
      'data/node_modules/dep.ts',
    )
    expect(await discover('./data/**/*.ts')).toEqual([
      join(dir, 'data/a.ts'),
      join(dir, 'data/b.ts'),
      join(dir, 'data/nested/c.ts'),
    ])
  })

  test('resolves several patterns and never repeats a file', async () => {
    await write('data/a.ts', 'seed/b.ts')
    expect(await discover('./data/**/*.ts', './seed/**/*.ts', './data/a.ts')).toEqual([
      join(dir, 'data/a.ts'),
      join(dir, 'seed/b.ts'),
    ])
  })

  test('honors negated patterns', async () => {
    await write('data/keep.ts', 'data/draft/skip.ts')
    expect(await discover('./data/**/*.ts', '!./data/draft/**')).toEqual([
      join(dir, 'data/keep.ts'),
    ])
  })

  test('matches files outside a data directory', async () => {
    await write('fixtures/products.ts')
    expect(await discover('./fixtures/*.ts')).toEqual([join(dir, 'fixtures/products.ts')])
  })

  test('never returns a file outside the project root', async () => {
    await write('data/a.ts')
    await writeFile(join(dir, '..', 'sibling-of-project.ts'), '')
    try {
      const found = await discover('../**/*.ts', './data/**/*.ts')
      expect(found).toEqual([join(dir, 'data/a.ts')])
    } finally {
      await rm(join(dir, '..', 'sibling-of-project.ts'), { force: true })
    }
  })
})
