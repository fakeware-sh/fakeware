import type { ReportStep } from './run'

export class GraphError extends Error {}

export class TransactionError extends Error {
  readonly rolledBack: ReportStep[]
  readonly failedEntity: string
  readonly unrevertableUpdates: boolean
  readonly compensationErrors: unknown[]

  constructor(
    message: string,
    options: {
      cause: unknown
      rolledBack: ReportStep[]
      failedEntity: string
      unrevertableUpdates?: boolean
      compensationErrors?: unknown[]
    },
  ) {
    super(message, { cause: options.cause })
    this.name = 'TransactionError'
    this.rolledBack = options.rolledBack
    this.failedEntity = options.failedEntity
    this.unrevertableUpdates = options.unrevertableUpdates ?? false
    this.compensationErrors = options.compensationErrors ?? []
  }
}
