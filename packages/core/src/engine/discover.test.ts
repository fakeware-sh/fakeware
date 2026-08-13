import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverDataFiles } from './discover'

describe('discoverDataFiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-discover-'))
  })
  afterEach(async () => {
    await chmod(join(dir, 'data'), 0o755).catch(() => {})
    await rm(dir, { recursive: true, force: true })
  })

  test('returns an empty list when the data directory is missing', async () => {
    expect(await discoverDataFiles(dir)).toEqual([])
  })

  test('lists data files sorted, skipping tests and declarations', async () => {
    const data = join(dir, 'data')
    await mkdir(join(data, 'nested'), { recursive: true })
    await writeFile(join(data, 'b.ts'), '')
    await writeFile(join(data, 'a.ts'), '')
    await writeFile(join(data, 'a.test.ts'), '')
    await writeFile(join(data, 'types.d.ts'), '')
    await writeFile(join(data, 'nested', 'c.ts'), '')
    expect(await discoverDataFiles(dir)).toEqual([
      join(data, 'a.ts'),
      join(data, 'b.ts'),
      join(data, 'nested', 'c.ts'),
    ])
  })

  test('rethrows non-ENOENT errors instead of hiding them', async () => {
    const data = join(dir, 'data')
    await mkdir(data)
    await writeFile(join(data, 'a.ts'), '')
    await chmod(data, 0o000)
    await expect(discoverDataFiles(dir)).rejects.toThrow()
  })
})
