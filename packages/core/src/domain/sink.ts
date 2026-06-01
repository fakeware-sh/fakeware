export type SinkRecord = Record<string, unknown> & { id: string }

export type SyncOperation =
  | { entity: string; action: 'upsert'; records: SinkRecord[] }
  | { entity: string; action: 'delete'; ids: string[] }

export interface ShopwareSink {
  upsert(entity: string, records: SinkRecord[]): Promise<void>
  delete(entity: string, ids: string[]): Promise<void>
  applyAtomic(operations: SyncOperation[]): Promise<void>
}
