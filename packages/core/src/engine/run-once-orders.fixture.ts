import { createInMemorySink } from '../domain'
import { toShopContext } from '../shopware/fetch-shop-context'
import type { ShopContextData } from '../shopware/shop-context'
import { runUp } from './run'

const projectRoot = process.argv[2]
if (!projectRoot) throw new Error('run-once-orders.fixture: missing projectRoot argv')

const states = ['open', 'completed']
const machines = ['order.state', 'order_delivery.state', 'order_transaction.state']
const data: ShopContextData = {
  currencies: [{ id: 'currency-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true }],
  languages: [{ id: 'language-en', name: 'English', locale: 'en-GB', isSystem: true }],
  salesChannels: [
    {
      id: 'sc-1',
      name: 'Storefront',
      typeId: 't',
      currencyId: 'currency-eur',
      languageId: 'language-en',
      countryId: null,
      active: true,
    },
  ],
  countries: [{ id: 'country-de', name: 'Germany', iso: 'DE', iso3: 'DEU' }],
  salutations: [{ id: 'sal-mr', name: 'Mr.', salutationKey: 'mr', displayName: 'Mr.' }],
  stateMachineStates: machines.flatMap((machineTechnicalName) =>
    states.map((technicalName) => ({
      id: `state-${machineTechnicalName}-${technicalName}`,
      name: technicalName,
      technicalName,
      machineTechnicalName,
    })),
  ),
  taxes: [{ id: 'tax-19', name: 'Std', taxRate: 19 }],
  paymentMethods: [],
  shippingMethods: [],
  mediaFolders: [],
  extensions: {},
}

const loaded = {
  config: { shopware: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' } },
  connection: { url: 'https://shop.test', clientId: 'i', clientSecret: 's' },
  configPath: `${projectRoot}/fakeware.config.ts`,
  projectRoot,
  plugins: [],
}

const sink = createInMemorySink()
await runUp({ loaded, sink, now: 'T', fakewareVersion: '1', shopContext: toShopContext(data) })
const writes = sink.calls.filter((c) => c.op === 'write')
process.stdout.write(JSON.stringify(writes))
