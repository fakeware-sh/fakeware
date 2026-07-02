export type SinkRecord = Record<string, unknown> & { id: string }

export type MediaUploadRecord = SinkRecord

export interface ShopwareSink {
  write(entity: string, records: SinkRecord[]): Promise<void>
  delete(entity: string, ids: string[]): Promise<void>
  uploadMedia?(records: MediaUploadRecord[], options?: { projectRoot?: string }): Promise<void>
}
