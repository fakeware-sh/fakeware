import { z } from 'zod'
import { ConfigError } from '../config'
import type { ShopContextFetcher } from '../shopware'
import type { FakewarePlugin } from './define'

const fnSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === 'function',
  'must be a function',
)

const pluginShapeSchema = z.object({
  name: z
    .string('is not a valid plugin (missing "name")')
    .min(1, 'is not a valid plugin (missing "name")'),
  fetchers: z.array(z.unknown(), '"fetchers" must be an array').optional(),
  hooks: z
    .object(
      {
        configResolved: fnSchema.optional(),
        contextReady: fnSchema.optional(),
        beforeApply: fnSchema.optional(),
        afterApply: fnSchema.optional(),
        beforeRevert: fnSchema.optional(),
        afterRevert: fnSchema.optional(),
        onError: fnSchema.optional(),
      },
      '"hooks" must be an object',
    )
    .optional(),
})

function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.path[0] === 'hooks' && issue.path.length > 1) {
    return `hook "${String(issue.path[1])}" must be a function`
  }
  return issue.message
}

export interface OwnedFetcher {
  plugin: string
  fetcher: ShopContextFetcher
}

export function loadPlugins(plugins: FakewarePlugin[] = []): FakewarePlugin[] {
  const seen = new Set<string>()
  for (const [i, plugin] of plugins.entries()) {
    const parsed = pluginShapeSchema.safeParse(plugin)
    if (!parsed.success) {
      const issue = parsed.error.issues[0] as z.core.$ZodIssue
      throw new ConfigError(`plugins[${i}] ${issueMessage(issue)}.`)
    }
    if (seen.has(plugin.name)) {
      throw new ConfigError(`plugins[${i}] duplicate plugin name "${plugin.name}".`)
    }
    seen.add(plugin.name)
  }
  return plugins
}

export function collectFetchers(plugins: FakewarePlugin[]): OwnedFetcher[] {
  return plugins.flatMap((plugin) =>
    (plugin.fetchers ?? []).map((fetcher) => ({ plugin: plugin.name, fetcher })),
  )
}
