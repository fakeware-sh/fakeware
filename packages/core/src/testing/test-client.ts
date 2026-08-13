import type { ShopwareClient } from '../shopware'

export interface TestClientCall {
  operation: string
  options: unknown
}

export interface TestClient {
  client: ShopwareClient
  readonly calls: TestClientCall[]
}

export type TestClientHandler =
  | unknown
  | ((operation: string, options: unknown) => unknown | Promise<unknown>)

export interface TestClientOptions {
  version?: string
}

export function createTestClient(
  handlers: Record<string, TestClientHandler>,
  options: TestClientOptions = {},
): TestClient {
  const calls: TestClientCall[] = []
  const version = options.version ?? '6.0.0'

  const invoke = async (operation: string, invokeOptions?: unknown): Promise<unknown> => {
    calls.push({ operation, options: invokeOptions })
    if (operation.includes('/_info/version')) return { version }
    const key = Object.keys(handlers).find((candidate) => operation.includes(candidate))
    if (key === undefined) {
      throw new Error(`createTestClient: no handler matches operation "${operation}".`)
    }
    const handler = handlers[key]
    if (typeof handler === 'function') {
      return await (handler as (op: string, opts: unknown) => unknown)(operation, invokeOptions)
    }
    return handler
  }

  return { client: { invoke } as unknown as ShopwareClient, calls }
}
