import { z } from 'zod'
import { parseRows } from './built-in-fetchers'
import type { ShopwareClient } from './client'
import { invokeAdmin, unwrapRows } from './search'

export interface InstalledExtension {
  name: string
  version: string
  label: string | null
  active: boolean
  kind: 'plugin' | 'app'
}

const LOOKUP_LIMIT = 25

const pluginRow = z.object({
  name: z.string(),
  version: z.string().nullish(),
  label: z.string().nullish(),
  active: z.boolean().nullish(),
  installedAt: z.string().nullish(),
})

const appRow = z.object({
  name: z.string(),
  version: z.string().nullish(),
  label: z.string().nullish(),
  active: z.boolean().nullish(),
})

function lookupBody(names: string[]): Record<string, unknown> {
  return {
    filter: [{ type: 'equalsAny', field: 'name', value: names }],
    limit: LOOKUP_LIMIT,
  }
}

function pick<Row extends { name: string }>(rows: Row[], names: string[]): Row | undefined {
  for (const name of names) {
    const match = rows.find((row) => row.name === name)
    if (match) return match
  }
  return undefined
}

export async function fetchInstalledExtension(
  client: ShopwareClient,
  names: string | string[],
): Promise<InstalledExtension | null> {
  const wanted = Array.isArray(names) ? names : [names]
  if (wanted.length === 0) return null

  const pluginRaw = await invokeAdmin(client, 'searchPlugin post /search/plugin', {
    body: lookupBody(wanted),
  })
  const plugins = parseRows('plugins', pluginRow, unwrapRows(pluginRaw)).filter(
    (row) => row.installedAt != null,
  )
  const plugin = pick(plugins, wanted)
  if (plugin) {
    return {
      name: plugin.name,
      version: plugin.version ?? '0.0.0',
      label: plugin.label ?? null,
      active: plugin.active ?? false,
      kind: 'plugin',
    }
  }

  const appRaw = await invokeAdmin(client, 'searchApp post /search/app', {
    body: lookupBody(wanted),
  })
  const app = pick(parseRows('apps', appRow, unwrapRows(appRaw)), wanted)
  if (!app) return null
  return {
    name: app.name,
    version: app.version ?? '0.0.0',
    label: app.label ?? null,
    active: app.active ?? false,
    kind: 'app',
  }
}

function segments(version: string): number[] {
  const core = version.split(/[-+]/)[0] ?? ''
  return core.split('.').map((part) => {
    const value = Number.parseInt(part, 10)
    return Number.isFinite(value) ? value : 0
  })
}

export function satisfiesMinVersion(version: string, minimum: string): boolean {
  const left = segments(version)
  const right = segments(minimum)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return true
}
