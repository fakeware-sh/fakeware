import { createInMemorySink } from '../domain'
import { fakeShopContext } from '../shopware/shop-context.fixture'
import { runUp } from './run'

const projectRoot = process.argv[2]
if (!projectRoot) throw new Error('run-once.fixture: missing projectRoot argv')
const loaded = {
  config: {
    shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
    transaction: { onError: 'rollback' as const, atomic: false },
  },
  connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
  configPath: `${projectRoot}/fakeware.config.ts`,
  projectRoot,
}

const sink = createInMemorySink()
await runUp({ loaded, sink, now: 'T', fakewareVersion: '1', shopContext: fakeShopContext() })
const upserts = sink.calls.filter((c) => c.op === 'upsert')
process.stdout.write(JSON.stringify(upserts))
