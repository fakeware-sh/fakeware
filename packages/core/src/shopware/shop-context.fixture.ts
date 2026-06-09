import { toShopContext } from './fetch-shop-context'
import type { ShopContext, ShopContextData } from './shop-context'

const EMPTY: ShopContextData = {
  currencies: [{ id: 'currency-eur', name: 'Euro', isoCode: 'EUR', isSystemDefault: true }],
  languages: [{ id: 'language-en', name: 'English', locale: 'en-GB', isSystem: true }],
  salesChannels: [
    {
      id: 'sales-channel-storefront',
      name: 'Storefront',
      typeId: 'type-storefront',
      currencyId: 'currency-eur',
      languageId: 'language-en',
      active: true,
    },
  ],
  countries: [],
  salutations: [],
  stateMachineStates: [],
  taxes: [],
  paymentMethods: [],
  shippingMethods: [],
  extensions: {},
}

export function fakeShopContext(overrides: Partial<ShopContextData> = {}): ShopContext {
  return toShopContext({ ...EMPTY, ...overrides })
}
