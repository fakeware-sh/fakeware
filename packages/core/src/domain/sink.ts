export type SinkRecord = Record<string, unknown> & { id: string }

export type SyncOperation =
  | { entity: string; action: 'upsert'; records: SinkRecord[] }
  | { entity: string; action: 'delete'; ids: string[] }

export interface BatchProgress {
  records: number
  recordsTotal: number
  batches: number
  batchesTotal: number
}

export type OnBatch = (progress: BatchProgress) => void

export interface ShopwareSink {
  upsert(entity: string, records: SinkRecord[], onBatch?: OnBatch): Promise<void>
  delete(entity: string, ids: string[], onBatch?: OnBatch): Promise<void>
  applyAtomic(operations: SyncOperation[]): Promise<void>
}
