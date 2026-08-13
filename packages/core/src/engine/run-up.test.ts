import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createRegistry } from '../define'
import { createModuleLoader } from '../runtime'
import { ShopwareApiError } from '../shopware'
import { fakeShopContext } from '../testing/fake-shop-context'
import { createInMemorySink } from '../testing/in-memory-sink'
import { buildWritePlan, type WritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { ApplyStopped } from './errors'
import { evaluateDataFiles } from './evaluate'
import { buildManifest, readManifest, writeManifest } from './manifest'
import { runUp } from './run-up'
import type { ApplyFailure, RunOptions } from './types'

const coreIndex = join(import.meta.dir, '..', 'index.ts')
const shopContext = fakeShopContext()

function up(opts: Omit<RunOptions, 'shopContext'>): ReturnType<typeof runUp> {
  return runUp({ shopContext, ...opts })
}

async function planFor(dir: string): Promise<WritePlan> {
  const files = await discoverDataFiles(dir)
  const drained = await evaluateDataFiles(files, createRegistry(), createModuleLoader())
  return buildWritePlan(drained, shopContext)
}

let counter = 0

function loadedFor(dir: string): LoadedConfig {
  return {
    config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    configPath: join(dir, 'fakeware.config.ts'),
    projectRoot: dir,
    plugins: [],
  }
}

async function scaffoldProject(root: string, files: Record<string, string>): Promise<string> {
  const dir = join(root, `p${counter++}`)
  await mkdir(join(dir, 'data'), { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, 'data', name), body)
  }
  return dir
}

const TAX_19 = `import { define } from '${coreIndex}'
define('tax', [{ $key: 'standard', taxRate: 19 }])
`
const PRODUCTS = `import { define, many, ref } from '${coreIndex}'
define('product', many(2, (ctx) => ({ name: 'p' + ctx.index, taxId: ref('tax').key('standard') })))
`

describe('runUp', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-run-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('writes every entity in dependency order and writes a manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink()
    const result = await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const writes = sink.calls.filter((c) => c.op === 'write').map((c) => c.entity)
    expect(writes.indexOf('tax')).toBeLessThan(writes.indexOf('product'))
    expect(sink.snapshot().get('product')?.size).toBe(2)
    expect(result.steps.find((s) => s.entity === 'tax')?.created).toBe(1)
    expect(result.manifestWritten).toBe(true)
  })

  test('one transactional request per entity (no batching)', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink()
    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    expect(sink.calls.filter((c) => c.op === 'write' && c.entity === 'product')).toHaveLength(1)
  })

  test('re-writes only the records whose hash drifted from the manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: [{ entity: 'tax', records: [{ id: 'unused', hash: 'STALE' }] }],
      }),
    )

    const sink = createInMemorySink()
    const result = await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const writes = sink.calls.filter((c) => c.op === 'write')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.entity).toBe('tax')
    expect(result.steps[0]?.created).toBe(1)
  })

  test('dry-run writes nothing and leaves no manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const sink = createInMemorySink()
    const result = await up({ loaded: loadedFor(dir), sink, dryRun: true })
    expect(sink.calls).toHaveLength(0)
    expect(result.manifestWritten).toBe(false)
  })

  test('a no-op run writes nothing but still reports steps', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    await up({ loaded: loadedFor(dir), sink: createInMemorySink(), now: 'T', fakewareVersion: '1' })

    const sink = createInMemorySink()
    const result = await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })
    expect(result.committed).toBe(0)
    expect(sink.calls).toHaveLength(0)
  })
})

describe('runUp — media & covers', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-media-run-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const PRODUCT_WITH_COVER = `import { define, media } from '${coreIndex}'
define('product', [
  { $key: 'p0', name: 'p0', cover: media({ url: 'https://x.test/hero.png', alt: 'Hero' }) },
  { $key: 'p1', name: 'p1', cover: media({ url: 'https://x.test/hero2.png', alt: 'Hero 2' }) },
])
`

  test('writes hoisted media before product, uploads bytes, and sets a product_media coverId', async () => {
    const dir = await scaffoldProject(root, { 'product.ts': PRODUCT_WITH_COVER })
    const sink = createInMemorySink()
    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const writes = sink.calls.filter((c) => c.op === 'write').map((c) => c.entity)
    expect(writes.indexOf('media')).toBeLessThan(writes.indexOf('product'))

    const uploads = sink.calls.filter((c) => c.op === 'upload')
    expect(uploads).toHaveLength(1)
    expect(uploads[0]?.ids).toHaveLength(2)

    const product = [...(sink.snapshot().get('product')?.values() ?? [])][0] as Record<
      string,
      unknown
    >
    const gallery = product.media as { id: string; mediaId: string }[]
    expect(product.coverId).toBe(gallery[0]?.id ?? '')
    expect(product.coverId).not.toBe(gallery[0]?.mediaId ?? '')
  })

  test('a second up uploads nothing (media idempotent)', async () => {
    const dir = await scaffoldProject(root, { 'product.ts': PRODUCT_WITH_COVER })
    const loaded = loadedFor(dir)
    await up({ loaded, sink: createInMemorySink(), now: 'T', fakewareVersion: '1' })

    const sink = createInMemorySink()
    await up({ loaded, sink, now: 'T', fakewareVersion: '1' })
    expect(sink.calls.filter((c) => c.op === 'upload')).toHaveLength(0)
    expect(sink.calls.filter((c) => c.op === 'write')).toHaveLength(0)
  })

  test('an upload failure stops the run without confirming media in the manifest', async () => {
    const dir = await scaffoldProject(root, { 'product.ts': PRODUCT_WITH_COVER })
    const loaded = loadedFor(dir)
    const sink = createInMemorySink({ failUploadOn: 'media' })
    await expect(up({ loaded, sink, now: 'T', fakewareVersion: '1' })).rejects.toBeInstanceOf(
      ApplyStopped,
    )

    const manifest = await readManifest(dir, loaded.connection.url)
    expect(manifest?.entities.find((e) => e.entity === 'media')).toBeUndefined()
  })
})

describe('runUp failure handling', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-fail-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('keeps successfully-committed entities, deletes nothing, stops with ApplyStopped', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failWriteOn: 'product' })

    await expect(
      up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' }),
    ).rejects.toBeInstanceOf(ApplyStopped)

    expect(sink.calls.filter((c) => c.op === 'delete')).toHaveLength(0)
    expect(sink.snapshot().get('tax')?.size).toBe(1)
  })

  test('persists a manifest of only the committed entities so down can clean up', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failWriteOn: 'product' })

    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' }).catch(() => {})

    const manifest = await readManifest(dir, 'https://shop.test')
    expect(manifest?.entities.map((e) => e.entity)).toEqual(['tax'])
  })

  test('re-running resumes: entities already in the manifest (by hash) are skipped, the rest are written', async () => {
    const hashDir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const hashPlan = await planFor(hashDir)
    const taxRecords = (hashPlan.records.get('tax') ?? []).map((r) => ({
      id: r.record.id,
      hash: r.hash,
    }))

    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: [{ entity: 'tax', records: taxRecords }],
      }),
    )

    const sink = createInMemorySink()
    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    const written = sink.calls.filter((c) => c.op === 'write').map((c) => c.entity)
    expect(written).toEqual(['product'])
    expect(sink.snapshot().get('product')?.size).toBe(2)
  })

  test('reports the failure once, before persisting, with the structured error', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const sink = createInMemorySink({ failWriteOn: 'product' })
    const failures: ApplyFailure[] = []

    await up({
      loaded: loadedFor(dir),
      sink,
      now: 'T',
      fakewareVersion: '1',
      reporter: { failed: (f) => failures.push(f) },
    }).catch(() => {})

    expect(failures).toHaveLength(1)
    expect(failures[0]?.entity).toBe('product')
    expect(failures[0]?.committed).toEqual(['tax'])
  })

  test('a ShopwareApiError from the sink surfaces to the reporter', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const failing = {
      async write(): Promise<void> {
        throw new ShopwareApiError('boom', {
          status: 400,
          entity: 'tax',
          errors: [
            { code: 'X', detail: 'bad', field: 'taxRate', pointer: '/0/taxRate', recordId: 'r' },
          ],
          retryable: false,
          cause: null,
        })
      },
      async delete(): Promise<void> {},
    }
    const failures: ApplyFailure[] = []
    await up({
      loaded: loadedFor(dir),
      sink: failing,
      now: 'T',
      fakewareVersion: '1',
      reporter: { failed: (f) => failures.push(f) },
    }).catch(() => {})

    expect(failures[0]?.error.errors[0]?.field).toBe('taxRate')
  })
})
