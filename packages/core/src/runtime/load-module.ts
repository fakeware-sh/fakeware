import { createJiti } from 'jiti'
import * as authoring from '../authoring'
import * as shopLookups from '../contract/shop-context'
import * as define from '../define'
import { definePlugin } from '../plugin'
import * as shopware from '../shopware'

export class LoadModuleError extends Error {}

const { media, MEDIA_UPLOAD_KEY, ShopContextError, ShopwareApiError, ShopwareConnectionError } =
  shopware

const core = {
  ...define,
  ...shopLookups,
  ...authoring,
  definePlugin,
  media,
  MEDIA_UPLOAD_KEY,
  ShopContextError,
  ShopwareApiError,
  ShopwareConnectionError,
}

const jiti = createJiti(import.meta.url, {
  virtualModules: {
    '@fakeware/core': core,
    '@fakeware/core/shopware': shopware,
  },
})

export async function loadModule<T = unknown>(absPath: string): Promise<T> {
  try {
    return (await jiti.import(absPath)) as T
  } catch (error) {
    throw new LoadModuleError(
      `Could not load ${absPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
