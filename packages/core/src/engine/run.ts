import type { LoadedConfig } from '../config'
import { recordHash } from '../define'
import type { ShopwareSink, SinkRecord } from '../domain'
import { buildWritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { evaluateDataFiles } from './evaluate'
import {
  buildManifest,
  type Manifest,
  type ManifestEntity,
  readManifest,
  removeManifest,
  writeManifest,
} from './manifest'

export interface Reporter {
  onStart?(entity: string): void
  onStep?(step: ReportStep): void
}

export interface ReportStep {
  entity: string
  created: number
  updated: number
  unchanged: number
  deleted: number
}

export interface RunOptions {
  loaded: LoadedConfig
  sink: ShopwareSink
  dryRun?: boolean
  reporter?: Reporter
  fakewareVersion?: string
  now?: string
}

export interface UpResult {
  steps: ReportStep[]
  manifestWritten: boolean
}

export interface DownResult {
  steps: ReportStep[]
  reverted: boolean
}

function priorHashes(manifest: Manifest | null): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>()
  for (const e of manifest?.entities ?? []) {
    map.set(e.entity, new Map(e.records.map((r) => [r.id, r.hash])))
  }
  return map
}

export async function runUp(opts: RunOptions): Promise<UpResult> {
  const { loaded, sink, dryRun, reporter } = opts
  const files = await discoverDataFiles(loaded.projectRoot)
  const drained = await evaluateDataFiles(files)
  const plan = buildWritePlan(drained)

  const prior = priorHashes(await readManifest(loaded.projectRoot, loaded.connection.url))
  const steps: ReportStep[] = []
  const manifestEntities: ManifestEntity[] = []

  for (const entity of plan.order) {
    reporter?.onStart?.(entity)
    const records = plan.records.get(entity) ?? []
    const priorForEntity = prior.get(entity) ?? new Map<string, string>()
    const toWrite: SinkRecord[] = []
    let created = 0
    let updated = 0
    let unchanged = 0
    const manifestRecords = records.map((record) => {
      const hash = recordHash(record)
      const previous = priorForEntity.get(record.id)
      if (previous === undefined) created++
      else if (previous === hash) unchanged++
      else updated++
      if (previous !== hash) toWrite.push(record)
      return { id: record.id, hash }
    })

    if (!dryRun && toWrite.length > 0) {
      await sink.upsert(entity, toWrite)
    }

    manifestEntities.push({ entity, records: manifestRecords })
    const step: ReportStep = { entity, created, updated, unchanged, deleted: 0 }
    steps.push(step)
    reporter?.onStep?.(step)
  }

  if (!dryRun) {
    await writeManifest(
      loaded.projectRoot,
      buildManifest({
        fakewareVersion: opts.fakewareVersion ?? '0.0.0',
        createdAt: opts.now ?? new Date().toISOString(),
        shopwareUrl: loaded.connection.url,
        entities: manifestEntities,
      }),
    )
  }

  return { steps, manifestWritten: !dryRun }
}

export async function runDown(opts: RunOptions): Promise<DownResult> {
  const { loaded, sink, dryRun, reporter } = opts
  const manifest = await readManifest(loaded.projectRoot, loaded.connection.url)
  if (!manifest) return { steps: [], reverted: false }

  const steps: ReportStep[] = []
  for (const entity of [...manifest.entities].reverse()) {
    reporter?.onStart?.(entity.entity)
    const ids = entity.records.map((r) => r.id)
    if (!dryRun && ids.length > 0) {
      await sink.delete(entity.entity, ids)
    }
    const step: ReportStep = {
      entity: entity.entity,
      created: 0,
      updated: 0,
      unchanged: 0,
      deleted: ids.length,
    }
    steps.push(step)
    reporter?.onStep?.(step)
  }

  if (!dryRun) await removeManifest(loaded.projectRoot, loaded.connection.url)
  return { steps, reverted: !dryRun }
}
