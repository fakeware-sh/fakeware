import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LoadedConfig } from '../config'
import type { CheckOutcome, FakewarePlugin } from '../plugin'
import { createTestClient } from '../testing'
import { validateProject } from './validate'

const coreIndex = join(import.meta.dir, '..', 'index.ts')

let root: string
let counter = 0

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'fw-validate-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function loadedFor(dir: string, plugins: FakewarePlugin[] = []): LoadedConfig {
  return {
    config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
    connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    configPath: join(dir, 'fakeware.config.ts'),
    projectRoot: dir,
    plugins,
  }
}

async function project(
  files: Record<string, string>,
  plugins: FakewarePlugin[] = [],
): Promise<LoadedConfig> {
  const dir = join(root, `p${counter++}`)
  await mkdir(join(dir, 'data'), { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, 'data', name), body)
  }
  return loadedFor(dir, plugins)
}

function checkPlugin(
  outcome: CheckOutcome | undefined,
  needsShop = false,
  onRun?: () => void,
): FakewarePlugin {
  return {
    name: 'gated',
    checks: [
      {
        name: 'compatible',
        needsShop,
        run: () => {
          onRun?.()
          return outcome
        },
      },
    ],
  }
}

const TAX = `import { define } from '${coreIndex}'
define('tax', [{ $key: 'standard', taxRate: 19 }])
`

const PRODUCTS = `import { define, many, ref } from '${coreIndex}'
define('product', many(3, (ctx) => ({
  name: \`P\${ctx.index}\`,
  taxId: ref('tax').key('standard'),
})))
`

describe('validateProject', () => {
  test('a clean project reports ok with its entities and record count', async () => {
    const result = await validateProject(await project({ 'a.ts': TAX, 'b.ts': PRODUCTS }))

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.entities.sort()).toEqual(['product', 'tax'])
    expect(result.records).toBe(4)
    expect(result.dataFiles).toHaveLength(2)
  })

  test('a project with no data files is ok but reports nothing to validate', async () => {
    const dir = join(root, 'empty')
    await mkdir(dir, { recursive: true })
    const result = await validateProject(loadedFor(dir))

    expect(result.ok).toBe(true)
    expect(result.dataFiles).toEqual([])
    expect(result.entities).toEqual([])
    expect(result.records).toBe(0)
  })

  test('a broken reference is reported as a references issue, not a crash', async () => {
    const result = await validateProject(
      await project({
        'a.ts': TAX,
        'b.ts': `import { define, ref } from '${coreIndex}'
define('product', [{ name: 'P', taxId: ref('tax').key('nope') }])
`,
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.check).toBe('references')
    expect(result.issues[0]?.message).toContain('nope')
  })

  test('a reference to an entity that was never defined is reported', async () => {
    const result = await validateProject(
      await project({
        'a.ts': `import { define, ref } from '${coreIndex}'
define('product', [{ name: 'P', taxId: ref('tax').key('standard') }])
`,
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.issues[0]?.check).toBe('references')
  })

  test('a data file that throws on import is reported as a dataFiles issue', async () => {
    const result = await validateProject(
      await project({ 'a.ts': `throw new Error('boom from a data file')\n` }),
    )

    expect(result.ok).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.check).toBe('dataFiles')
    expect(result.issues[0]?.message).toContain('boom from a data file')
  })

  test('shop tokens resolve against a placeholder so validation stays offline', async () => {
    const result = await validateProject(
      await project({
        'a.ts': `import { define, shop } from '${coreIndex}'
define('product', [{
  name: 'P',
  taxId: shop.tax(19),
  currencyId: shop.defaultCurrency,
  countryId: shop.country('DE'),
  stateId: shop.orderState('open'),
}])
`,
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.entities).toEqual(['product'])
  })

  test('a shop lookup that would fail against a real shop does not mask a real ref error', async () => {
    const result = await validateProject(
      await project({
        'a.ts': TAX,
        'b.ts': `import { define, ref, shop } from '${coreIndex}'
define('product', [{
  name: 'P',
  currencyId: shop.currency('XYZ'),
  taxId: ref('tax').key('missing'),
}])
`,
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.issues[0]?.check).toBe('references')
    expect(result.issues[0]?.message).toContain('missing')
  })

  test('data that reads live shop values is reported as shop-dependent, not as a failure', async () => {
    const result = await validateProject(
      await project({
        'a.ts': `import { define, shop } from '${coreIndex}'
const warehouses = (shop.extensions.pickware ?? {}).warehouses ?? []
if (warehouses.length === 0) throw new Error('no warehouse found in the shop')
define('product', [{ name: 'P' }])
`,
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.issues[0]?.check).toBe('dataFiles')
  })

  test('a shop-dependent throw during planning does not fail validation', async () => {
    const result = await validateProject(
      await project({
        'a.ts': `import { define, shop } from '${coreIndex}'
define('product', [{
  name: 'P',
  warehouseId: () => {
    const list = shop.context().salesChannels
    if (list.length === 0) throw new Error('no warehouse configured in the shop')
    return list[0].id
  },
}])
`,
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.shopDependent).toContain('no warehouse configured in the shop')
  })

  test('validation never writes a manifest or touches the project', async () => {
    const loaded = await project({ 'a.ts': TAX, 'b.ts': PRODUCTS })
    await validateProject(loaded)

    const entries = await import('node:fs/promises').then((fs) => fs.readdir(loaded.projectRoot))
    expect(entries).toEqual(['data'])
  })

  test('reports no checks for a project without plugins', async () => {
    const result = await validateProject(await project({ 'a.ts': TAX }))
    expect(result.checks).toEqual([])
    expect(result.checksSkipped).toBe(0)
  })
})

describe('validateProject plugin checks', () => {
  test('skips shop checks and counts them when offline is requested', async () => {
    let ran = false
    const loaded = await project({ 'a.ts': TAX }, [
      checkPlugin({ level: 'error', message: 'must not run' }, true, () => {
        ran = true
      }),
    ])
    const result = await validateProject(loaded, { offline: true })

    expect(ran).toBe(false)
    expect(result.ok).toBe(true)
    expect(result.checks).toEqual([])
    expect(result.checksSkipped).toBe(1)
    expect(result.skipReason).toBe('offline')
  })

  test('skips shop checks when the connection is not usable', async () => {
    let ran = false
    const loaded = await project({ 'a.ts': TAX }, [
      checkPlugin({ level: 'error', message: 'must not run' }, true, () => {
        ran = true
      }),
    ])
    loaded.connection = { url: 'https://shop.test', clientId: '', clientSecret: '' }
    const result = await validateProject(loaded)

    expect(ran).toBe(false)
    expect(result.ok).toBe(true)
    expect(result.checksSkipped).toBe(1)
    expect(result.skipReason).toBe('noConnection')
  })

  test('runs offline checks without a client', async () => {
    const loaded = await project({ 'a.ts': TAX }, [checkPlugin(undefined)])
    loaded.connection = { url: '', clientId: '', clientSecret: '' }
    const result = await validateProject(loaded)

    expect(result.checks).toEqual([
      { plugin: 'gated', check: 'compatible', level: 'ok', message: 'passed' },
    ])
    expect(result.checksSkipped).toBe(0)
    expect(result.skipReason).toBe(null)
  })

  test('runs shop checks by default with the supplied client', async () => {
    const { client } = createTestClient({})
    let seen: unknown
    const loaded = await project({ 'a.ts': TAX }, [
      {
        name: 'gated',
        checks: [
          {
            name: 'compatible',
            needsShop: true,
            run: (ctx) => {
              seen = ctx.client
            },
          },
        ],
      },
    ])
    const result = await validateProject(loaded, { client })

    expect(seen).toBe(client)
    expect(result.checksSkipped).toBe(0)
    expect(result.skipReason).toBe(null)
    expect(result.checks).toHaveLength(1)
  })

  test('a failing check makes the whole project not ok', async () => {
    const loaded = await project({ 'a.ts': TAX }, [
      checkPlugin({ level: 'error', message: 'not installed', hint: 'install it' }),
    ])
    const result = await validateProject(loaded)

    expect(result.ok).toBe(false)
    expect(result.issues).toEqual([
      { check: 'plugins', message: 'gated: not installed install it' },
    ])
  })

  test('a warning leaves the project ok', async () => {
    const loaded = await project({ 'a.ts': TAX }, [
      checkPlugin({ level: 'warn', message: 'old version' }),
    ])
    const result = await validateProject(loaded)

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.checks[0]?.level).toBe('warn')
  })

  test('checks still run when there are no data files', async () => {
    const dir = join(root, 'no-files')
    await mkdir(dir, { recursive: true })
    const result = await validateProject(
      loadedFor(dir, [checkPlugin({ level: 'error', message: 'not installed' })]),
    )

    expect(result.ok).toBe(false)
    expect(result.dataFiles).toEqual([])
    expect(result.issues).toHaveLength(1)
  })

  test('a plugin issue accumulates alongside a data file issue', async () => {
    const loaded = await project(
      { 'a.ts': `import { define } from '${coreIndex}'\nthrow new Error('boom')\n` },
      [checkPlugin({ level: 'error', message: 'not installed' })],
    )
    const result = await validateProject(loaded)

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.check)).toEqual(['plugins', 'dataFiles'])
  })
})
