import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { ConfigError } from '../config'
import {
  buildManifest,
  type ManifestEntity,
  manifestPath,
  readManifest,
  writeManifest,
} from './manifest'

const entities: ManifestEntity[] = [
  { entity: 'tax', records: [{ id: 'a', hash: 'h1' }] },
  { entity: 'product', records: [{ id: 'b', hash: 'h2' }] },
]

const input = {
  fakewareVersion: '1.0.0',
  createdAt: '2026-01-01T00:00:00.000Z',
  shopwareUrl: 'https://shop.test',
  entities,
}

describe('manifest', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fakeware-mf-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('round-trips through write/read', async () => {
    const manifest = buildManifest(input)
    await writeManifest(dir, manifest)
    expect(await readManifest(dir, input.shopwareUrl)).toEqual(manifest)
  })

  test('keeps a separate manifest per shop URL', async () => {
    const a = buildManifest({ ...input, shopwareUrl: 'https://a.test' })
    const b = buildManifest({ ...input, shopwareUrl: 'https://b.test' })
    await writeManifest(dir, a)
    await writeManifest(dir, b)
    expect(manifestPath(dir, 'https://a.test')).not.toBe(manifestPath(dir, 'https://b.test'))
    expect(await readManifest(dir, 'https://a.test')).toEqual(a)
    expect(await readManifest(dir, 'https://b.test')).toEqual(b)
  })

  test('checksum is stable for the same entities and sensitive to id changes', () => {
    const a = buildManifest(input)
    const b = buildManifest(input)
    expect(a.checksum).toBe(b.checksum)
    const changed = buildManifest({
      ...input,
      entities: [{ entity: 'tax', records: [{ id: 'a', hash: 'DIFFERENT' }] }],
    })
    expect(changed.checksum).not.toBe(a.checksum)
  })

  test('returns null when no manifest exists', async () => {
    expect(await readManifest(dir, input.shopwareUrl)).toBeNull()
  })

  test('rejects a manifest whose checksum no longer matches its entities', async () => {
    await writeManifest(dir, buildManifest(input))
    const tampered = { ...buildManifest(input), entities: [] }
    await writeFile(manifestPath(dir, input.shopwareUrl), JSON.stringify(tampered))
    await expect(readManifest(dir, input.shopwareUrl)).rejects.toBeInstanceOf(ConfigError)
  })

  test('rejects an unsupported (higher) version', async () => {
    await writeManifest(dir, buildManifest(input))
    await writeFile(
      manifestPath(dir, input.shopwareUrl),
      JSON.stringify({ version: 99, entities: [] }),
    )
    await expect(readManifest(dir, input.shopwareUrl)).rejects.toBeInstanceOf(ConfigError)
  })

  test('rejects a manifest that is not valid JSON', async () => {
    await writeManifest(dir, buildManifest(input))
    await writeFile(manifestPath(dir, input.shopwareUrl), '{not json')
    await expect(readManifest(dir, input.shopwareUrl)).rejects.toThrow('not valid JSON')
  })

  test('rejects a manifest with a malformed shape', async () => {
    await writeManifest(dir, buildManifest(input))
    const broken = {
      ...buildManifest(input),
      entities: [{ entity: 'tax', records: [{ id: 'a' }] }],
    }
    await writeFile(manifestPath(dir, input.shopwareUrl), JSON.stringify(broken))
    await expect(readManifest(dir, input.shopwareUrl)).rejects.toThrow('unexpected shape')
  })

  test('rethrows non-ENOENT read errors instead of treating them as missing', async () => {
    await writeManifest(dir, buildManifest(input))
    const manifestDir = dirname(manifestPath(dir, input.shopwareUrl))
    await chmod(manifestDir, 0o000)
    try {
      await expect(readManifest(dir, input.shopwareUrl)).rejects.toThrow()
    } finally {
      await chmod(manifestDir, 0o755)
    }
  })

  test('cleans up the tmp file when the final rename fails', async () => {
    const manifest = buildManifest(input)
    const path = manifestPath(dir, input.shopwareUrl)
    await mkdir(path, { recursive: true })
    await expect(writeManifest(dir, manifest)).rejects.toThrow()
    const leftovers = (await readdir(dirname(path))).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})
