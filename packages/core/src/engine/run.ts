import type { LoadedConfig } from '../config'
import { recordHash } from '../define'
import type { BatchProgress, ShopwareSink, SinkRecord, SyncOperation } from '../domain'
import type { ConfigContext, FakewarePlugin, PluginContext } from '../plugin'
import {
  collectFetchers,
  createPluginLogger,
  type LogSink,
  runPluginHook,
  runPluginResultHook,
} from '../plugin'
import {
  ATOMIC_REQUEST_BYTE_LIMIT,
  estimateSyncBytes,
  fetchShopContext,
  type ShopContext,
} from '../shopware'
import { buildWritePlan } from './build-graph'
import { discoverDataFiles } from './discover'
import { TransactionError } from './errors'
import { evaluateDataFiles } from './evaluate'
import {
  buildManifest,
  type Manifest,
  type ManifestEntity,
  type ManifestRecord,
  readManifest,
  removeManifest,
  writeManifest,
} from './manifest'

export interface Reporter {
  onStart?(entity: string, records?: number): void
  onBatch?(progress: BatchProgress): void
  onStep?(step: ReportStep): void
  onTransactionStart?(info: { mode: 'atomic' | 'saga' }): void
  onCommit?(info: { committed: number }): void
  onCompensate?(entity: string, count: number): void
  onCompensateFail?(entity: string): void
  onSkip?(info: { entity: string; error: unknown }): void
  onStop?(info: { failedEntity: string; error: unknown; message: string }): void
}

export interface ReportStep {
  entity: string
  created: number
  updated: number
  unchanged: number
  deleted: number
}

export type OnError = 'rollback' | 'continue' | 'stop'

export interface TransactionOptions {
  onError: OnError
  atomic: boolean
}

export interface RunOptions {
  loaded: LoadedConfig
  sink: ShopwareSink
  dryRun?: boolean
  reporter?: Reporter
  fakewareVersion?: string
  now?: string
  transaction?: TransactionOptions
  shopContext?: ShopContext
  mode?: string
  logSink?: LogSink
}

export interface UpResult {
  steps: ReportStep[]
  manifestWritten: boolean
  mode: 'atomic' | 'saga' | 'dry-run' | 'noop'
  committed: number
  rolledBack: number
}

export interface DownResult {
  steps: ReportStep[]
  reverted: boolean
}

interface EntityWrite {
  entity: string
  toWrite: SinkRecord[]
  createdIds: string[]
  manifestRecords: ManifestRecord[]
  step: ReportStep
}

function priorHashes(manifest: Manifest | null): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>()
  for (const e of manifest?.entities ?? []) {
    map.set(e.entity, new Map(e.records.map((r) => [r.id, r.hash])))
  }
  return map
}

function resolveTransaction(opts: RunOptions): TransactionOptions {
  return opts.transaction ?? opts.loaded.config.transaction
}

function configContextFor(opts: RunOptions, plugin: FakewarePlugin): ConfigContext {
  return {
    config: opts.loaded.config,
    connection: opts.loaded.connection,
    projectRoot: opts.loaded.projectRoot,
    mode: opts.mode ?? 'development',
    logger: createPluginLogger(plugin.name, opts.logSink),
  }
}

function pluginContextFor(
  opts: RunOptions,
  plugin: FakewarePlugin,
  shopContext: ShopContext,
): PluginContext {
  return { ...configContextFor(opts, plugin), shopContext }
}

function diffEntity(
  entity: string,
  records: SinkRecord[],
  prior: Map<string, string>,
): EntityWrite {
  const toWrite: SinkRecord[] = []
  const createdIds: string[] = []
  let created = 0
  let updated = 0
  let unchanged = 0
  const manifestRecords = records.map((record) => {
    const hash = recordHash(record)
    const previous = prior.get(record.id)
    if (previous === undefined) {
      created++
      createdIds.push(record.id)
    } else if (previous === hash) {
      unchanged++
    } else {
      updated++
    }
    if (previous !== hash) toWrite.push(record)
    return { id: record.id, hash }
  })
  return {
    entity,
    toWrite,
    createdIds,
    manifestRecords,
    step: { entity, created, updated, unchanged, deleted: 0 },
  }
}

function partialWrite(w: EntityWrite, committed: number): EntityWrite | null {
  if (committed <= 0) return null
  const createdSet = new Set(w.createdIds)
  const prefix = w.toWrite.slice(0, committed)
  const createdIds = prefix.map((r) => r.id).filter((id) => createdSet.has(id))
  const updated = prefix.length - createdIds.length
  if (createdIds.length === 0 && updated === 0) return null
  return {
    entity: w.entity,
    toWrite: [],
    createdIds,
    manifestRecords: [],
    step: { entity: w.entity, created: 0, updated, unchanged: 0, deleted: 0 },
  }
}

export async function runUp(opts: RunOptions): Promise<UpResult> {
  const { loaded } = opts
  const plugins = loaded.plugins
  const dryRun = opts.dryRun ?? false

  await runPluginHook(plugins, 'configResolved', 'configResolved', (plugin) =>
    configContextFor(opts, plugin),
  )

  const shopContext =
    opts.shopContext ?? (await fetchShopContext(loaded.connection, collectFetchers(plugins)))

  await runPluginHook(plugins, 'contextReady', 'contextReady', (plugin) =>
    pluginContextFor(opts, plugin, shopContext),
  )
  await runPluginHook(plugins, 'beforeApply', 'beforeApply', (plugin) => ({
    ...pluginContextFor(opts, plugin, shopContext),
    dryRun,
  }))

  const result = await applyPlan(opts, shopContext)

  await runPluginResultHook(
    plugins,
    'afterApply',
    'afterApply',
    (plugin) => ({ ...pluginContextFor(opts, plugin, shopContext), dryRun }),
    result,
  )

  return result
}

async function applyPlan(opts: RunOptions, shopContext: ShopContext): Promise<UpResult> {
  const { loaded, sink, dryRun, reporter } = opts
  const tx = resolveTransaction(opts)
  const files = await discoverDataFiles(loaded.projectRoot)
  const drained = await evaluateDataFiles(files)
  const plan = buildWritePlan(drained, shopContext)

  const prior = priorHashes(await readManifest(loaded.projectRoot, loaded.connection.url))

  const writes: EntityWrite[] = plan.order.map((entity) =>
    diffEntity(
      entity,
      plan.records.get(entity) ?? [],
      prior.get(entity) ?? new Map<string, string>(),
    ),
  )

  const steps = writes.map((w) => w.step)
  const manifestEntities: ManifestEntity[] = writes.map((w) => ({
    entity: w.entity,
    records: w.manifestRecords,
  }))
  const committed = steps.reduce((n, s) => n + s.created + s.updated, 0)
  const pending = writes.filter((w) => w.toWrite.length > 0)

  if (dryRun || pending.length === 0) {
    for (const w of writes) {
      reporter?.onStart?.(w.entity)
      reporter?.onStep?.(w.step)
    }
    return {
      steps,
      manifestWritten: false,
      mode: dryRun ? 'dry-run' : 'noop',
      committed: 0,
      rolledBack: 0,
    }
  }

  const writeManifestNow = (entities: ManifestEntity[]): Promise<void> =>
    writeManifest(
      loaded.projectRoot,
      buildManifest({
        fakewareVersion: opts.fakewareVersion ?? '0.0.0',
        createdAt: opts.now ?? new Date().toISOString(),
        shopwareUrl: loaded.connection.url,
        entities,
      }),
    )

  const operations: SyncOperation[] = pending.map((w) => ({
    entity: w.entity,
    action: 'upsert',
    records: w.toWrite,
  }))

  if (tx.atomic && estimateSyncBytes(operations) <= ATOMIC_REQUEST_BYTE_LIMIT) {
    reporter?.onTransactionStart?.({ mode: 'atomic' })
    try {
      await sink.applyAtomic(operations)
    } catch (error) {
      const message = 'Apply failed — Shopware rolled back all changes.'
      reporter?.onStop?.({ failedEntity: '', error, message })
      throw new TransactionError(message, {
        cause: error,
        rolledBack: [],
        failedEntity: '',
      })
    }
    await writeManifestNow(manifestEntities)
    reporter?.onCommit?.({ committed })
    return { steps, manifestWritten: true, mode: 'atomic', committed, rolledBack: 0 }
  }

  reporter?.onTransactionStart?.({ mode: 'saga' })
  const written: EntityWrite[] = []
  const skipped: { entity: string; error: unknown }[] = []

  for (const w of pending) {
    reporter?.onStart?.(w.entity, w.toWrite.length)
    let committedRecords = 0
    try {
      await sink.upsert(w.entity, w.toWrite, (progress) => {
        committedRecords = progress.records
        reporter?.onBatch?.(progress)
      })
      written.push(w)
      reporter?.onStep?.(w.step)
    } catch (error) {
      if (tx.onError === 'stop') {
        const message = `Writing ${w.entity} failed — stopped.`
        reporter?.onStop?.({ failedEntity: w.entity, error, message })
        throw new TransactionError(message, {
          cause: error,
          rolledBack: [],
          failedEntity: w.entity,
        })
      }
      if (tx.onError === 'continue') {
        skipped.push({ entity: w.entity, error })
        reporter?.onSkip?.({ entity: w.entity, error })
        continue
      }
      const message = `Could not apply ${w.entity}.`
      reporter?.onStop?.({ failedEntity: w.entity, error, message })
      const partial = partialWrite(w, committedRecords)
      const toCompensate = partial ? [...written, partial] : written
      const { rolledBack, unrevertableUpdates, compensationErrors } = await compensate(
        sink,
        toCompensate,
        reporter,
      )
      throw new TransactionError(message, {
        cause: error,
        rolledBack,
        failedEntity: w.entity,
        unrevertableUpdates,
        compensationErrors,
      })
    }
  }

  for (const w of writes) {
    if (!written.includes(w) && !skipped.some((s) => s.entity === w.entity)) {
      reporter?.onStart?.(w.entity)
      reporter?.onStep?.(w.step)
    }
  }

  if (skipped.length > 0) {
    const writtenEntities = new Set(written.map((w) => w.entity))
    await writeManifestNow(restrictManifest(manifestEntities, prior, writtenEntities))
    const first = skipped[0] as { entity: string; error: unknown }
    throw new TransactionError(
      `Applied with ${skipped.length} skipped entit${skipped.length === 1 ? 'y' : 'ies'}.`,
      { cause: skipped, rolledBack: [], failedEntity: first.entity },
    )
  }

  await writeManifestNow(manifestEntities)
  reporter?.onCommit?.({ committed })
  return { steps, manifestWritten: true, mode: 'saga', committed, rolledBack: 0 }
}

async function compensate(
  sink: ShopwareSink,
  written: EntityWrite[],
  reporter?: Reporter,
): Promise<{
  rolledBack: ReportStep[]
  unrevertableUpdates: boolean
  compensationErrors: unknown[]
}> {
  const rolledBack: ReportStep[] = []
  const compensationErrors: unknown[] = []
  for (const w of [...written].reverse()) {
    if (w.createdIds.length === 0) continue
    try {
      await sink.delete(w.entity, w.createdIds)
      rolledBack.push({
        entity: w.entity,
        created: 0,
        updated: 0,
        unchanged: 0,
        deleted: w.createdIds.length,
      })
      reporter?.onCompensate?.(w.entity, w.createdIds.length)
    } catch (error) {
      compensationErrors.push(error)
      reporter?.onCompensateFail?.(w.entity)
    }
  }
  const unrevertableUpdates = written.some((w) => w.step.updated > 0)
  return { rolledBack, unrevertableUpdates, compensationErrors }
}

function restrictManifest(
  desired: ManifestEntity[],
  prior: Map<string, Map<string, string>>,
  writtenEntities: Set<string>,
): ManifestEntity[] {
  const out: ManifestEntity[] = []
  const seen = new Set<string>()
  for (const e of desired) {
    seen.add(e.entity)
    if (writtenEntities.has(e.entity)) {
      out.push(e)
    } else {
      const priorRecords = prior.get(e.entity)
      if (priorRecords && priorRecords.size > 0) {
        out.push({
          entity: e.entity,
          records: [...priorRecords].map(([id, hash]) => ({ id, hash })),
        })
      }
    }
  }
  for (const [entity, records] of prior) {
    if (!seen.has(entity) && records.size > 0) {
      out.push({ entity, records: [...records].map(([id, hash]) => ({ id, hash })) })
    }
  }
  return out
}

export async function runDown(opts: RunOptions): Promise<DownResult> {
  const { loaded } = opts
  const plugins = loaded.plugins
  const dryRun = opts.dryRun ?? false

  await runPluginHook(plugins, 'configResolved', 'configResolved', (plugin) =>
    configContextFor(opts, plugin),
  )

  const manifest = await readManifest(loaded.projectRoot, loaded.connection.url)
  if (!manifest) return { steps: [], reverted: false }

  const needsContext = plugins.some(
    (plugin) =>
      plugin.hooks?.contextReady || plugin.hooks?.beforeRevert || plugin.hooks?.afterRevert,
  )
  const shopContext = needsContext
    ? (opts.shopContext ?? (await fetchShopContext(loaded.connection, collectFetchers(plugins))))
    : opts.shopContext

  if (shopContext) {
    await runPluginHook(plugins, 'contextReady', 'contextReady', (plugin) =>
      pluginContextFor(opts, plugin, shopContext),
    )
    await runPluginHook(plugins, 'beforeRevert', 'beforeRevert', (plugin) => ({
      ...pluginContextFor(opts, plugin, shopContext),
      dryRun,
    }))
  }

  const result = await revertManifest(opts, manifest)

  if (shopContext) {
    await runPluginResultHook(
      plugins,
      'afterRevert',
      'afterRevert',
      (plugin) => ({ ...pluginContextFor(opts, plugin, shopContext), dryRun }),
      result,
    )
  }

  return result
}

async function revertManifest(opts: RunOptions, manifest: Manifest): Promise<DownResult> {
  const { loaded, sink, dryRun, reporter } = opts
  reporter?.onTransactionStart?.({ mode: 'saga' })

  const steps: ReportStep[] = []
  for (const entity of [...manifest.entities].reverse()) {
    const ids = entity.records.map((r) => r.id)
    reporter?.onStart?.(entity.entity, ids.length)
    if (!dryRun && ids.length > 0) {
      await sink.delete(entity.entity, ids, (progress) => reporter?.onBatch?.(progress))
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
