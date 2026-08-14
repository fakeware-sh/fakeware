import type { PluginCheck } from '@fakeware/core'
import { fetchInstalledExtension, satisfiesMinVersion } from '@fakeware/core/shopware'

export const PICKWARE_EXTENSIONS = ['PickwareErpStarter', 'PickwareErp']
export const PICKWARE_MINIMUM_VERSION = '3.0.0'

const REMOVE_HINT = 'Install Pickware ERP, or remove pickware() from your fakeware config.'

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const record = error as { status?: unknown; statusCode?: unknown; response?: unknown }
  for (const value of [record.status, record.statusCode]) {
    if (typeof value === 'number') return value
  }
  const response = record.response
  if (response && typeof response === 'object') {
    const status = (response as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return null
}

export const pickwareInstalledCheck: PluginCheck = {
  name: 'pickware erp installed',
  needsShop: true,
  async run({ client, connection }) {
    let extension: Awaited<ReturnType<typeof fetchInstalledExtension>>
    try {
      extension = await fetchInstalledExtension(client, PICKWARE_EXTENSIONS)
    } catch (error) {
      const status = statusOf(error)
      if (status !== 401 && status !== 403) throw error
      return {
        level: 'warn',
        message:
          'Could not verify Pickware ERP: the API credentials lack the plugin:read privilege.',
        hint: 'Grant plugin:read to the integration to enable this check.',
      }
    }

    if (!extension) {
      return {
        level: 'error',
        message: `Pickware ERP is not installed on ${connection.url}.`,
        hint: REMOVE_HINT,
      }
    }
    if (!extension.active) {
      return {
        level: 'error',
        message: `Pickware ERP ${extension.version} is installed on ${connection.url} but not activated.`,
        hint: 'Activate Pickware ERP in the Shopware admin under Extensions.',
      }
    }
    if (!satisfiesMinVersion(extension.version, PICKWARE_MINIMUM_VERSION)) {
      return {
        level: 'warn',
        message: `Pickware ERP ${extension.version} is older than the supported ${PICKWARE_MINIMUM_VERSION}.`,
        hint: 'Some Pickware entities may be missing or shaped differently.',
      }
    }
  },
}
