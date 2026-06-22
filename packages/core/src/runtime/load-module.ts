import { createJiti } from 'jiti'
import * as define from '../define'
import { definePlugin } from '../plugin'
import * as shopLookups from '../shopware/shop-context'

export class LoadModuleError extends Error {}

const core = { ...define, ...shopLookups, definePlugin }

const jiti = createJiti(import.meta.url, {
  virtualModules: { '@fakeware/core': core },
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
