import { createInMemorySink } from '../domain'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { runUp } from './run'

const projectRoot = process.argv[2]
if (!projectRoot) throw new Error('run-once.fixture: missing projectRoot argv')
const loaded = {
  config: {
    shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
  },
  connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
  configPath: `${projectRoot}/fakeware.config.ts`,
  projectRoot,
  plugins: [],
}

const sink = createInMemorySink()
await runUp({ loaded, sink, now: 'T', fakewareVersion: '1', shopContext: fakeShopContext() })
const writes = sink.calls.filter((c) => c.op === 'write')
process.stdout.write(JSON.stringify(writes))
