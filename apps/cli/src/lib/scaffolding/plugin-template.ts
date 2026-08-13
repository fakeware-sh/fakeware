import type { ScaffoldValues } from './values'

export function pluginSource(values: ScaffoldValues): string {
  return `import { definePlugin, type ShopContextFetcher } from '@fakeware/core'
import { searchAll, unwrapRows } from '@fakeware/core/shopware'

export interface WarehouseRow {
  id: string
  name?: string
  [key: string]: unknown
}

export const WAREHOUSES_KEY = 'warehouses'

const SEARCH_OPERATION = 'searchWarehouse post /search/warehouse'

export function warehouses(extensions: Record<string, unknown>): WarehouseRow[] {
  return (extensions[WAREHOUSES_KEY] as WarehouseRow[] | undefined) ?? []
}

export const warehousesFetcher: ShopContextFetcher = {
  entity: 'warehouses',
  fetch: (client) => searchAll<WarehouseRow>(client, SEARCH_OPERATION),
  merge: (data, raw) => {
    data.extensions[WAREHOUSES_KEY] = unwrapRows<WarehouseRow>(raw)
  },
}

export default definePlugin({
  name: '${values.projectName}',
  fetchers: [warehousesFetcher],
  hooks: {
    contextReady: ({ shopContext, logger }) => {
      logger.info(\`loaded \${warehouses(shopContext.extensions).length} warehouses\`)
    },
  },
})
`
}

export function pluginTest(values: ScaffoldValues): string {
  return `import { describe, expect, test } from 'bun:test'
import type { ShopContextData } from '@fakeware/core'
import {
  createCollectingLogSink,
  createTestClient,
  createTestPluginContext,
  runPluginHookOnce,
} from '@fakeware/core/testing'
import plugin, { WAREHOUSES_KEY, warehouses, warehousesFetcher } from './index'

describe('${values.projectName}', () => {
  test('the fetcher collects rows into the shop context extensions', async () => {
    const { client, calls } = createTestClient({
      '/search/warehouse': { data: [{ id: 'wh-1', name: 'Main' }], total: 1 },
    })

    const raw = await warehousesFetcher.fetch(client)
    const data = { extensions: {} } as ShopContextData
    warehousesFetcher.merge(data, raw)

    expect(warehouses(data.extensions)).toEqual([{ id: 'wh-1', name: 'Main' }])
    expect(calls.some((call) => call.operation.includes('/search/warehouse'))).toBe(true)
  })

  test('contextReady logs how many warehouses were loaded', async () => {
    const sink = createCollectingLogSink()
    const ctx = createTestPluginContext({
      sink,
      shopData: { extensions: { [WAREHOUSES_KEY]: [{ id: 'wh-1' }] } },
    })

    await runPluginHookOnce(plugin, 'contextReady', ctx)

    expect(sink.entries.some((entry) => entry.message.includes('1 warehouses'))).toBe(true)
  })
})
`
}

export function pluginReadme(values: ScaffoldValues): string {
  return `# ${values.projectName}

A [fakeware](https://github.com/fakeware-sh/fakeware) plugin.

## Development

\`\`\`sh
bun install
bun test
bun run typecheck
\`\`\`

## Usage

Add the plugin to a fakeware project's config:

\`\`\`ts
import { defineConfig } from '@fakeware/core/config'
import plugin from '${values.projectName}'

export default defineConfig({
  shopware: {
    url: '$SHOPWARE_URL',
    clientId: '$SHOPWARE_CLIENT_ID',
    clientSecret: '$SHOPWARE_CLIENT_SECRET',
  },
  plugins: [plugin],
})
\`\`\`

## What's in here

- \`src/index.ts\` — the plugin: a \`ShopContextFetcher\` that pages a Shopware admin
  search endpoint with \`searchAll\`, merges the rows into \`shopContext.extensions\`,
  and a \`contextReady\` hook that reads them back.
- \`src/index.test.ts\` — tests using \`createTestClient\` (canned admin responses) and
  \`createTestPluginContext\` (a plugin context with a collecting log sink).

Replace the warehouse example with the entity your plugin cares about.

## Publishing

- Keep the \`@fakeware/core\` peer range in \`package.json\` in sync with the core
  versions you support.
- Run \`bun test\` and \`bun run typecheck\` before publishing.
- Publish with \`npm publish --access public\`.
`
}
