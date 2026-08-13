export class ShopwareConnectionError extends Error {}

export interface ParsedApiError {
  code: string
  detail: string
  field: string | null
  pointer: string | null
  recordId: string | null
}

export interface ShopwareApiErrorOptions {
  status: number | null
  entity: string | null
  errors: ParsedApiError[]
  retryable: boolean
  retryAfterMs?: number | null
  cause: unknown
}

export class ShopwareApiError extends Error {
  readonly status: number | null
  readonly entity: string | null
  readonly errors: ParsedApiError[]
  readonly retryable: boolean
  readonly retryAfterMs: number | null

  constructor(message: string, options: ShopwareApiErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ShopwareApiError'
    this.status = options.status
    this.entity = options.entity
    this.errors = options.errors
    this.retryable = options.retryable
    this.retryAfterMs = options.retryAfterMs ?? null
  }
}
