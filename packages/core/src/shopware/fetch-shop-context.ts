import type { ShopContext } from '../contract/shop-context'
import type { OwnedFetcher } from '../plugin'
import { BUILT_IN_FETCHERS } from './built-in-fetchers'
import { createShopwareClient, type ShopwareClient } from './client'
import { emptyData, toShopContext } from './context-build'
import { ShopwareConnectionError } from './errors'
import { toConnectionError } from './operations'
import { withRetry } from './retry'
import type { ShopwareConnection } from './types'

const FETCH_CONCURRENCY = 4

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await task(items[index] as T)
    }
  })
  await Promise.all(workers)
  return results
}

export async function fetchShopContext(
  connection: ShopwareConnection,
  extraFetchers: OwnedFetcher[] = [],
  client: ShopwareClient = createShopwareClient(connection),
): Promise<ShopContext> {
  const builtIn: OwnedFetcher[] = BUILT_IN_FETCHERS.map((fetcher) => ({
    plugin: '',
    fetcher,
  }))
  const fetchers = [...builtIn, ...extraFetchers]
  const data = emptyData()
  try {
    await client.invoke('infoShopwareVersion get /_info/version')
  } catch (error) {
    throw toConnectionError(connection, error)
  }
  const results = await mapWithConcurrency(
    fetchers,
    FETCH_CONCURRENCY,
    async ({ plugin, fetcher }) => {
      try {
        return await withRetry(() => fetcher.fetch(client))
      } catch (error) {
        if (!plugin) throw toConnectionError(connection, error)
        throw new ShopwareConnectionError(
          `Plugin "${plugin}" fetcher "${fetcher.entity}" failed.`,
          { cause: error },
        )
      }
    },
  )
  for (const [i, { fetcher }] of fetchers.entries()) {
    fetcher.merge(data, results[i])
  }
  return toShopContext(data)
}
