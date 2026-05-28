import * as p from '@clack/prompts'
import type { ShopwareConnection } from '@fakeware/core/shopware'
import { getProtocol, normalizeShopUrl, type UrlProtocol } from '../../lib/utils'

function required(value: string | undefined): string | undefined {
  return !value || value.trim().length === 0 ? 'Required' : undefined
}

export type ShopConnectionPrefill = Partial<ShopwareConnection> & { protocol?: UrlProtocol }

export async function promptShopConnection(
  prefill: ShopConnectionPrefill = {},
): Promise<ShopwareConnection> {
  const answers = await p.group(
    {
      url: () =>
        prefill.url
          ? Promise.resolve(prefill.url)
          : p.text({
              message: 'Where is your Shopware shop?',
              placeholder: 'my-shop.example',
              validate: required,
            }),
      protocol: ({ results }): Promise<UrlProtocol | symbol> => {
        if (prefill.protocol) return Promise.resolve(prefill.protocol)
        const fromUrl = getProtocol(results.url ?? '')
        if (fromUrl) return Promise.resolve(fromUrl)
        return p.select<UrlProtocol>({
          message: 'Which protocol does it use?',
          initialValue: 'https',
          options: [
            { value: 'https', label: 'https', hint: 'recommended — TLS encrypted' },
            { value: 'http', label: 'http', hint: 'local or dev shops only' },
          ],
        })
      },
      clientId: () =>
        prefill.clientId
          ? Promise.resolve(prefill.clientId)
          : p.text({ message: 'Integration client ID', validate: required }),
      clientSecret: () =>
        prefill.clientSecret
          ? Promise.resolve(prefill.clientSecret)
          : p.password({ message: 'Integration client secret', validate: required }),
    },
    {
      onCancel: () => {
        p.cancel('Cancelled.')
        process.exit(1)
      },
    },
  )

  return {
    url: normalizeShopUrl(answers.url, answers.protocol as UrlProtocol),
    clientId: answers.clientId,
    clientSecret: answers.clientSecret,
  }
}
