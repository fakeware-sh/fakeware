import { ConfigError } from './errors'

const ENV_REF = /\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/g

function resolveString(value: string, env: Record<string, string | undefined>): string {
  return value.replace(ENV_REF, (_, braced: string | undefined, bare: string | undefined) => {
    const name = (braced ?? bare) as string
    const resolved = env[name]
    if (resolved === undefined) {
      throw new ConfigError(`Config references $${name}, but it is not set (check your .env).`)
    }
    return resolved
  })
}

export function interpolate<T>(value: T, env: Record<string, string | undefined>): T {
  if (typeof value === 'string') {
    return resolveString(value, env) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, env)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolate(v, env)
    }
    return out as T
  }
  return value
}
