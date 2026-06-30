export type SinkRecord = Record<string, unknown> & { id: string }

export interface ShopwareSink {
  write(entity: string, records: SinkRecord[]): Promise<void>
  delete(entity: string, ids: string[]): Promise<void>
}
