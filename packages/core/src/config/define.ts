import type { FakewareUserConfig } from './schema'

export interface ConfigEnv {
  env: Record<string, string | undefined>
  mode: string
}

export type FakewareConfigFn = (env: ConfigEnv) => FakewareUserConfig

export function defineConfig(config: FakewareUserConfig): FakewareUserConfig
export function defineConfig(config: FakewareConfigFn): FakewareConfigFn
export function defineConfig(
  config: FakewareUserConfig | FakewareConfigFn,
): FakewareUserConfig | FakewareConfigFn {
  return config
}
