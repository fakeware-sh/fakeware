import * as p from '@clack/prompts'
import type { ShopwareConnection } from '@fakeware/core/shopware'
import { getProtocol, normalizeShopUrl, type UrlProtocol } from '../../lib/utils'

function required(value: string | undefined): string | undefined {
  return !value || value.trim().length === 0 ? 'Required' : undefined
}

export type ShopConnectionPrefill = Partial<ShopwareConnection> & { protocol?: UrlProtocol }

export interface ShopConnectionOptions {
  edit?: boolean
}

export async function promptShopConnection(
  prefill: ShopConnectionPrefill = {},
  options: ShopConnectionOptions = {},
): Promise<ShopwareConnection> {
  const { edit = false } = options

  const answers = await p.group(
    {
      url: () =>
        !edit && prefill.url
          ? Promise.resolve(prefill.url)
          : p.text({
              message: 'Where is your Shopware shop?',
              placeholder: 'my-shop.example',
              initialValue: edit ? prefill.url : undefined,
              validate: required,
            }),
      protocol: ({ results }): Promise<UrlProtocol | symbol> => {
        if (!edit && prefill.protocol) return Promise.resolve(prefill.protocol)
        const fromUrl = getProtocol(results.url ?? '')
        if (fromUrl) return Promise.resolve(fromUrl)
        return p.select<UrlProtocol>({
          message: 'Which protocol does it use?',
          initialValue: prefill.protocol ?? 'https',
          options: [
            { value: 'https', label: 'https', hint: 'recommended — TLS encrypted' },
            { value: 'http', label: 'http', hint: 'local or dev shops only' },
          ],
        })
      },
      clientId: () =>
        !edit && prefill.clientId
          ? Promise.resolve(prefill.clientId)
          : p.text({
              message: 'Integration client ID',
              initialValue: edit ? prefill.clientId : undefined,
              validate: required,
            }),
      clientSecret: () =>
        !edit && prefill.clientSecret
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
