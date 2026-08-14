export const LIVE_VERSION_ID = '0fa91ce3e96a4bc2be4bd9ce752c3425'

export interface ShopwareConnection {
  url: string
  clientId: string
  clientSecret: string
}

function usable(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 && !trimmed.includes('${')
}

export function isConnectionConfigured(connection: ShopwareConnection | undefined): boolean {
  if (!connection) return false
  return usable(connection.url) && usable(connection.clientId) && usable(connection.clientSecret)
}
