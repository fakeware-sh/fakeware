import { z } from 'zod'

export const shopwareSchema = z.object({
  url: z.string().min(1, 'shopware.url is required'),
  clientId: z.string().min(1, 'shopware.clientId is required'),
  clientSecret: z.string().min(1, 'shopware.clientSecret is required'),
})

export const fakewareConfigSchema = z.object({
  shopware: shopwareSchema.optional(),
})

export type FakewareConfig = z.output<typeof fakewareConfigSchema>

export type FakewareUserConfig = z.input<typeof fakewareConfigSchema>
