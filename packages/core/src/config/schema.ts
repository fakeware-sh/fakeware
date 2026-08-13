import { z } from 'zod'
import type { FakewarePlugin } from '../plugin'

export const shopwareSchema = z.object({
  url: z.string().min(1, 'shopware.url is required'),
  clientId: z.string().min(1, 'shopware.clientId is required'),
  clientSecret: z.string().min(1, 'shopware.clientSecret is required'),
})

const pluginSchema = z.custom<FakewarePlugin>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string',
  'plugins entries must be created with definePlugin()',
)

export const fakewareConfigSchema = z.object({
  shopware: shopwareSchema.optional(),
  plugins: z.array(pluginSchema).optional(),
})

export type FakewareConfig = z.output<typeof fakewareConfigSchema>

export type FakewareUserConfig = z.input<typeof fakewareConfigSchema>
