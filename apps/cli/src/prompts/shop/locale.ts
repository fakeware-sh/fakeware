import * as p from '@clack/prompts'
import type { ShopInfo } from '@fakeware/core/shopware'
import { cancelable } from '../cancel'

export async function promptShopLocale(info: ShopInfo, prefill?: string): Promise<string> {
  if (prefill) return prefill

  return cancelable(
    await p.select({
      message: 'Default locale for generated data?',
      initialValue: info.defaultLocale,
      options: info.locales.map((value) => ({ value, label: value })),
    }),
  )
}
