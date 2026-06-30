import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createInMemorySink } from '../domain'
import { ShopwareApiError } from '../shopware'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { buildWritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { ApplyStopped } from './errors'
import { evaluateDataFiles } from './evaluate'
import { buildManifest, readManifest, writeManifest } from './manifest'
import { type ApplyFailure, type RunOptions, runDown, runUp } from './run'

const coreIndex = join(import.meta.dir, '..', 'index.ts')
const shopContext = fakeShopContext()

function up(opts: Omit<RunOptions, 'shopContext'>): ReturnType<typeof runUp> {
  return runUp({ shopContext, ...opts })
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

async function runFixture(fixture: string, projectRoot: string): Promise<string> {
  const proc = Bun.spawn(['bun', 'run', fixture, projectRoot], { stdout: 'pipe' })
  const out = await new Response(proc.stdout).text()
  await proc.exited
  return out
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
define('product', many(2, (ctx) => ({ name: 'p' + ctx.index, taxId: ref('tax/standard') })))
`

describe('runUp / runDown', () => {
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

  test('a second up in a fresh process touches nothing (idempotent)', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const fixture = join(import.meta.dir, 'run-once.fixture.ts')

    const first = await runFixture(fixture, dir)
    expect(JSON.parse(first).length).toBeGreaterThan(0)

    const second = await runFixture(fixture, dir)
    expect(JSON.parse(second)).toEqual([])
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

  test('down deletes exactly the manifest records (reverse order) and removes the manifest', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const loaded = loadedFor(dir)
    await up({ loaded, sink: createInMemorySink(), now: 'T', fakewareVersion: '1' })

    const sink = createInMemorySink()
    const result = await runDown({ loaded, sink })

    const deletes = sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)
    expect(deletes.indexOf('product')).toBeLessThan(deletes.indexOf('tax'))
    expect(result.reverted).toBe(true)

    const after = await runDown({ loaded, sink: createInMemorySink() })
    expect(after.reverted).toBe(false)
  })

  test('down with no manifest is a friendly no-op', async () => {
    const dir = await scaffoldProject(root, {})
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink })
    expect(result.reverted).toBe(false)
    expect(result.failures).toEqual([])
    expect(sink.calls).toHaveLength(0)
  })
})

describe('runDown resilience', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-down-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function seedManifest(dir: string, entities: string[]): Promise<void> {
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: entities.map((entity) => ({
          entity,
          records: [{ id: `${entity}-1`, hash: 'h' }],
        })),
      }),
    )
  }

  test('converges across passes: a conflict clears once its dependent is deleted', async () => {
    const dir = await scaffoldProject(root, {})
    // manifest order [tax, product] → reverse tries product first, then tax.
    // tax is "in use" until product is gone; one extra pass should clear it.
    await seedManifest(dir, ['tax', 'product'])
    const sink = createInMemorySink({
      failDeleteWhile: (entity, deleted) => entity === 'tax' && !deleted.has('product'),
    })

    const result = await runDown({ loaded: loadedFor(dir), sink })

    expect(result.reverted).toBe(true)
    expect(result.failures).toEqual([])
    const deletes = sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)
    expect(deletes).toEqual(['product', 'tax'])
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('keeps only the still-blocked entities in the manifest and reports failures', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])
    const failures: ApplyFailure[] = []
    const sink = createInMemorySink({ failDeleteOn: 'tax' })

    const result = await runDown({
      loaded: loadedFor(dir),
      sink,
      reporter: { failed: (f) => failures.push(f) },
    })

    expect(result.reverted).toBe(false)
    expect(result.failures.map((f) => f.entity)).toEqual(['tax'])
    expect(result.failures[0]?.error).toBeInstanceOf(ShopwareApiError)
    expect(failures.map((f) => f.entity)).toEqual(['tax'])

    const manifest = await readManifest(dir, 'https://shop.test')
    expect(manifest?.entities.map((e) => e.entity)).toEqual(['tax'])
  })

  test('re-running down after the conflict clears finishes the teardown (converges)', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])

    await runDown({ loaded: loadedFor(dir), sink: createInMemorySink({ failDeleteOn: 'tax' }) })
    // manifest now lists only tax; conflict cleared on the retry.
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink })

    expect(result.reverted).toBe(true)
    expect(sink.calls.filter((c) => c.op === 'delete').map((c) => c.entity)).toEqual(['tax'])
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })

  test('an unexpected (non-Shopware) delete error aborts rather than being swallowed', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax'])
    const sink = createInMemorySink()
    sink.delete = async () => {
      throw new TypeError('boom')
    }
    await expect(runDown({ loaded: loadedFor(dir), sink })).rejects.toBeInstanceOf(TypeError)
  })

  test('dry-run reports steps, deletes nothing, leaves the manifest', async () => {
    const dir = await scaffoldProject(root, {})
    await seedManifest(dir, ['tax', 'product'])
    const sink = createInMemorySink()
    const result = await runDown({ loaded: loadedFor(dir), sink, dryRun: true })

    expect(result.reverted).toBe(false)
    expect(sink.calls).toHaveLength(0)
    expect(await readManifest(dir, 'https://shop.test')).not.toBeNull()
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
    const hashPlan = buildWritePlan(
      await evaluateDataFiles(await discoverDataFiles(hashDir)),
      shopContext,
    )
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

describe('manifest write-ahead (crash safety)', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-wal-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('up records an entity as pending in the manifest BEFORE its sync lands', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const base = createInMemorySink()
    let pendingAtWrite: boolean | undefined
    const sink = {
      async write(entity: string, records: { id: string }[]): Promise<void> {
        const m = await readManifest(dir, 'https://shop.test')
        pendingAtWrite = m?.entities.find((e) => e.entity === entity)?.pending
        await base.write(entity, records)
      },
      delete: base.delete,
    }
    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    expect(pendingAtWrite).toBe(true)
    const final = await readManifest(dir, 'https://shop.test')
    expect(final?.entities.find((e) => e.entity === 'tax')?.pending).toBeUndefined()
  })

  test('a pending entity left by a crash is re-sent on the next up (not trusted)', async () => {
    const hashDir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    const hashPlan = buildWritePlan(
      await evaluateDataFiles(await discoverDataFiles(hashDir)),
      shopContext,
    )
    const taxRecords = (hashPlan.records.get('tax') ?? []).map((r) => ({
      id: r.record.id,
      hash: r.hash,
    }))

    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19 })
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: [{ entity: 'tax', records: taxRecords, pending: true }],
      }),
    )

    const sink = createInMemorySink()
    await up({ loaded: loadedFor(dir), sink, now: 'T', fakewareVersion: '1' })

    // pending = unconfirmed, so it is re-written rather than skipped as unchanged
    expect(sink.calls.filter((c) => c.op === 'write').map((c) => c.entity)).toEqual(['tax'])
    const final = await readManifest(dir, 'https://shop.test')
    expect(final?.entities.find((e) => e.entity === 'tax')?.pending).toBeUndefined()
  })

  test('down marks an entity as pending in the manifest BEFORE its delete lands', async () => {
    const dir = await scaffoldProject(root, {})
    await writeManifest(
      dir,
      buildManifest({
        fakewareVersion: '1',
        createdAt: 'T',
        shopwareUrl: 'https://shop.test',
        entities: [{ entity: 'tax', records: [{ id: 'tax-1', hash: 'h' }] }],
      }),
    )
    const base = createInMemorySink()
    let pendingAtDelete: boolean | undefined
    const sink = {
      write: base.write,
      async delete(entity: string, ids: string[]): Promise<void> {
        const m = await readManifest(dir, 'https://shop.test')
        pendingAtDelete = m?.entities.find((e) => e.entity === entity)?.pending
        await base.delete(entity, ids)
      },
    }
    const result = await runDown({ loaded: loadedFor(dir), sink })

    expect(pendingAtDelete).toBe(true)
    expect(result.reverted).toBe(true)
    expect(await readManifest(dir, 'https://shop.test')).toBeNull()
  })
})
