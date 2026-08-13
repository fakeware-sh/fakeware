import type { LoadedConfig } from '../config'
import type { ShopwareSink, SinkRecord } from '../domain'
import type { LogEntry } from '../plugin'
import type { ShopContext, ShopwareApiError, ShopwareClient } from '../shopware'
import type { ManifestRecord } from './manifest'

export interface ReportStep {
  entity: string
  created: number
  updated: number
  unchanged: number
  deleted: number
}

export interface ApplyFailure {
  entity: string
  committed: string[]
  error: ShopwareApiError
}

export interface Reporter {
  entityStart?(entity: string, records: number): void
  entityDone?(step: ReportStep): void
  failed?(failure: ApplyFailure): void
  log?(entry: LogEntry): void
}

export interface RunOptions {
  loaded: LoadedConfig
  sink: ShopwareSink
  client?: ShopwareClient
  dryRun?: boolean
  debug?: boolean
  reporter?: Reporter
  fakewareVersion?: string
  now?: string
  shopContext?: ShopContext
  mode?: string
}

export interface UpResult {
  steps: ReportStep[]
  manifestWritten: boolean
  committed: number
  dataFiles: number
}

export interface DownResult {
  steps: ReportStep[]
  reverted: boolean
  failures: ApplyFailure[]
}

export interface EntityWrite {
  entity: string
  toWrite: SinkRecord[]
  manifestRecords: ManifestRecord[]
  step: ReportStep
}
