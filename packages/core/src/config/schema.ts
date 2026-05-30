import { z } from 'zod'

export const shopwareSchema = z.object({
  url: z.string().min(1, 'shopware.url is required'),
  clientId: z.string().min(1, 'shopware.clientId is required'),
  clientSecret: z.string().min(1, 'shopware.clientSecret is required'),
})

export const mediaSchema = z.object({
  provider: z.string(),
  perProduct: z
    .object({
      min: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    })
    .optional(),
})

export const pluginRefSchema = z.union([
  z.string(),
  z.tuple([z.string(), z.record(z.string(), z.unknown())]),
])

export const fakewareConfigSchema = z.object({
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  shopware: shopwareSchema.optional(),
  seed: z.string().optional(),
  batchSize: z.number().int().positive().default(100),
  generators: z.record(z.string(), z.unknown()).default({}),
  media: mediaSchema.optional(),
  plugins: z.array(pluginRefSchema).default([]),
})

export type FakewareConfig = z.output<typeof fakewareConfigSchema>

export type FakewareUserConfig = z.input<typeof fakewareConfigSchema>
