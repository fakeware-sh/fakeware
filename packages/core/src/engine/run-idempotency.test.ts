import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import { createRegistry } from '../define'
import { createModuleLoader } from '../runtime'
import { fakeShopContext } from '../testing/fake-shop-context'
import { createInMemorySink } from '../testing/in-memory-sink'
import { buildWritePlan, type WritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { evaluateDataFiles } from './evaluate'
import { buildManifest, readManifest, writeManifest } from './manifest'
import { runDown } from './run-down'
import { runUp } from './run-up'
import type { RunOptions } from './types'

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
define('product', many(2, (ctx) => ({ name: 'p' + ctx.index, taxId: ref('tax').key('standard') })))
`

describe('runUp idempotency across processes', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fakeware-run-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('a second up in a fresh process touches nothing (idempotent)', async () => {
    const dir = await scaffoldProject(root, { 'tax.ts': TAX_19, 'product.ts': PRODUCTS })
    const fixture = join(import.meta.dir, 'run-once.fixture.ts')

    const first = await runFixture(fixture, dir)
    expect(JSON.parse(first).length).toBeGreaterThan(0)

    const second = await runFixture(fixture, dir)
    expect(JSON.parse(second)).toEqual([])
  })

  test('builder-based order data is idempotent across fresh processes (deterministic assoc ids)', async () => {
    const ORDERS = `import { faker } from '@faker-js/faker'
import { builders, define, many, shop } from '${coreIndex}'
faker.seed(1)
define('order', many(5, (ctx) => {
  const b = builders(ctx)
  const addr = b.address({ firstName: faker.person.firstName(), countryId: shop.country('DE'), salutationId: shop.salutation('mr') })
  return b.order({
    orderNumber: '' + (10000 + ctx.index),
    salesChannelId: shop.defaultSalesChannel,
    currencyId: shop.currency('EUR'),
    billing: addr,
    lineItems: b.lineItems.products(Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
      product: 'prod-' + faker.number.int({ min: 0, max: 9 }),
      label: faker.commerce.productName(),
      unitPrice: faker.number.float({ min: 5, max: 500, fractionDigits: 2 }),
      quantity: faker.number.int({ min: 1, max: 3 }),
    }))),
    shippingCost: 4.99,
    deliveries: [b.delivery({ ship: addr, method: 'ship-1', cost: 4.99 })],
    payment: b.payment({ method: 'pay-1', amount: 100 }),
  })
}))
`
    const dir = await scaffoldProject(root, { 'orders.ts': ORDERS })
    const fixture = join(import.meta.dir, 'run-once-orders.fixture.ts')

    const first = await runFixture(fixture, dir)
    const firstWrites = JSON.parse(first)
    expect(firstWrites.length).toBeGreaterThan(0)
    expect(firstWrites.find((w: { entity: string }) => w.entity === 'order')).toBeTruthy()

    const second = await runFixture(fixture, dir)
    expect(JSON.parse(second)).toEqual([])
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
    const hashPlan = await planFor(hashDir)
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
