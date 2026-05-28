import * as p from '@clack/prompts'
import pc from 'picocolors'
import { fetchShopInfo, validateShopConnection } from '../../utils/shop'
import { getProtocol, normalizeShopUrl, type UrlProtocol } from '../../utils/url'

export interface InitInputFlags {
  output?: string
  url?: string
  clientId?: string
  clientSecret?: string
  locale?: string
  yes?: boolean
}

export interface InitInputs {
  location: string
  url: string
  clientId: string
  clientSecret: string
  locale?: string
}

function required(value: string | undefined): string | undefined {
  return !value || value.trim().length === 0 ? 'Required' : undefined
}

function onCancel(): never {
  p.cancel('Setup cancelled.')
  process.exit(1)
}

async function gatherConnection(flags: InitInputFlags): Promise<{
  location: string
  url: string
  clientId: string
  clientSecret: string
}> {
  const answers = await p.group(
    {
      location: () =>
        flags.output
          ? Promise.resolve(flags.output)
          : p.text({
              message: 'Where should the project be created?',
              initialValue: './',
            }),
      url: () =>
        flags.url
          ? Promise.resolve(flags.url)
          : p.text({
              message: 'Where is your Shopware shop?',
              placeholder: 'my-shop.example',
              validate: required,
            }),
      protocol: ({ results }): Promise<UrlProtocol | symbol> => {
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
        flags.clientId
          ? Promise.resolve(flags.clientId)
          : p.text({ message: 'Integration client ID', validate: required }),
      clientSecret: () =>
        flags.clientSecret
          ? Promise.resolve(flags.clientSecret)
          : p.password({ message: 'Integration client secret', validate: required }),
    },
    { onCancel },
  )

  return {
    location: answers.location,
    url: normalizeShopUrl(answers.url, answers.protocol as UrlProtocol),
    clientId: answers.clientId,
    clientSecret: answers.clientSecret,
  }
}

async function gatherProject(
  flags: InitInputFlags,
  locales: string[],
  defaultLocale: string,
): Promise<{ locale: string }> {
  const answers = await p.group(
    {
      locale: () =>
        flags.locale
          ? Promise.resolve(flags.locale)
          : p.select({
              message: 'Default locale for generated data?',
              initialValue: defaultLocale,
              options: locales.map((value) => ({ value, label: value })),
            }),
    },
    { onCancel },
  )

  return { locale: answers.locale }
}

export async function gatherInputs(flags: InitInputFlags): Promise<InitInputs> {
  const complete = Boolean(flags.url && flags.clientId && flags.clientSecret)
  if (flags.yes || complete) {
    return {
      location: flags.output ?? '.',
      url: flags.url ? normalizeShopUrl(flags.url) : '',
      clientId: flags.clientId ?? '',
      clientSecret: flags.clientSecret ?? '',
      locale: flags.locale,
    }
  }

  p.intro(pc.bgCyan(pc.black(' Fakeware ')))

  const connection = await gatherConnection(flags)

  const s = p.spinner()
  s.start('Connecting to your Shopware shop')
  try {
    await validateShopConnection(connection)
    s.stop(`Connected to ${pc.cyan(connection.url)}`)
  } catch (error) {
    s.stop('Could not connect to your Shopware shop')
    p.cancel(error instanceof Error ? error.message : 'Connection failed.')
    process.exit(1)
  }

  const info = await fetchShopInfo(connection)
  const project = await gatherProject(flags, info.locales, info.defaultLocale)

  return { ...connection, locale: project.locale }
}
