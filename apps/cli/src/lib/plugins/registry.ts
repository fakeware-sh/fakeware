export interface OfficialPlugin {
  id: string
  packageName: string
  importName: string
  version: string
  label: string
  hint: string
  recommended?: boolean
}

export const OFFICIAL_PLUGINS = [
  {
    id: 'pickware',
    packageName: '@fakeware/plugin-pickware',
    importName: 'pickware',
    version: '^1.1.0',
    label: 'Pickware',
    hint: 'Seed Pickware ERP data: warehouses, suppliers, stock, and return orders',
  },
] as const satisfies readonly OfficialPlugin[]

export type OfficialPluginId = (typeof OFFICIAL_PLUGINS)[number]['id']

export const officialPlugins: readonly OfficialPlugin[] = OFFICIAL_PLUGINS

function validIds(): string {
  return officialPlugins.map((plugin) => plugin.id).join(', ')
}

export function findPlugins(ids: readonly string[]): OfficialPlugin[] {
  return ids.map((id) => {
    const found = officialPlugins.find((plugin) => plugin.id === id || plugin.packageName === id)
    if (!found) {
      throw new Error(`Unknown plugin: "${id}". Valid plugins: ${validIds()}`)
    }
    return found
  })
}

export function resolvePluginFlag(raw: string): OfficialPlugin[] {
  const value = raw.trim().toLowerCase()
  if (value === 'none' || value === '') return []
  if (value === 'all') return [...officialPlugins]
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
  return findPlugins(tokens)
}
