import { z } from 'zod'
import type { FakewarePlugin } from '../plugin/define'

export const shopwareSchema = z.object({
  url: z.string().min(1, 'shopware.url is required'),
  clientId: z.string().min(1, 'shopware.clientId is required'),
  clientSecret: z.string().min(1, 'shopware.clientSecret is required'),
})

export const transactionSchema = z.object({
  onError: z.enum(['rollback', 'continue', 'stop']).default('rollback'),
  atomic: z.boolean().default(true),
})

export const fakewareConfigSchema = z.object({
  shopware: shopwareSchema.optional(),
  transaction: transactionSchema.prefault({}),
})

export type TransactionConfig = z.output<typeof transactionSchema>

export type FakewareConfig = z.output<typeof fakewareConfigSchema>

export type FakewareUserConfig = z.input<typeof fakewareConfigSchema> & {
  plugins?: FakewarePlugin[]
}
