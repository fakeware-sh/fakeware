import type { LoadedConfig } from '../config'
import type { ShopwareSink, SinkRecord } from '../domain'
import {
  type ConfigContext,
  collectFetchers,
  createPluginLogger,
  type FakewarePlugin,
  type LogEntry,
  type PluginContext,
  runPluginHook,
  runPluginResultHook,
} from '../plugin'
import {
  fetchShopContext,
  type ShopContext,
  ShopwareApiError,
  type ShopwareClient,
} from '../shopware'
import { buildWritePlan, type PlanRecord } from './build-graph'
import { discoverDataFiles } from './discover'
import { ApplyStopped } from './errors'
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
}

export interface DownResult {
  steps: ReportStep[]
  reverted: boolean
  failures: ApplyFailure[]
}

interface EntityWrite {
  entity: string
  toWrite: SinkRecord[]
  manifestRecords: ManifestRecord[]
  step: ReportStep
}

function reporterLogSink(reporter?: Reporter) {
  return {
    debug: false,
    write(entry: LogEntry): void {
      reporter?.log?.(entry)
    },
  }
}

function priorHashes(manifest: Manifest | null): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>()
  for (const e of manifest?.entities ?? []) {
    if (e.pending) continue
    map.set(e.entity, new Map(e.records.map((r) => [r.id, r.hash])))
  }
  return map
}

function configContextFor(opts: RunOptions, plugin: FakewarePlugin): ConfigContext {
  return {
    config: opts.loaded.config,
    connection: opts.loaded.connection,
    projectRoot: opts.loaded.projectRoot,
    mode: opts.mode ?? 'development',
    logger: createPluginLogger(plugin.name, reporterLogSink(opts.reporter)),
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
  records: PlanRecord[],
  prior: Map<string, string>,
): EntityWrite {
  const toWrite: SinkRecord[] = []
  let created = 0
  let updated = 0
  let unchanged = 0
  const manifestRecords = records.map(({ record, hash }) => {
    const previous = prior.get(record.id)
    if (previous === undefined) created++
    else if (previous === hash) unchanged++
    else updated++
    if (previous !== hash) toWrite.push(record)
    return { id: record.id, hash }
  })
  return {
    entity,
    toWrite,
    manifestRecords,
    step: { entity, created, updated, unchanged, deleted: 0 },
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
    opts.shopContext ??
    (await fetchShopContext(loaded.connection, collectFetchers(plugins), opts.client))

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
  const files = await discoverDataFiles(loaded.projectRoot)
  const drained = await evaluateDataFiles(files)
  const plan = buildWritePlan(drained, shopContext)

  const prior = priorHashes(await readManifest(loaded.projectRoot, loaded.connection.url))
  const writes = plan.order.map((entity) =>
    diffEntity(
      entity,
      plan.records.get(entity) ?? [],
      prior.get(entity) ?? new Map<string, string>(),
    ),
  )
  const steps = writes.map((w) => w.step)

  if (dryRun) {
    for (const w of writes) {
      reporter?.entityStart?.(w.entity, w.toWrite.length)
      reporter?.entityDone?.(w.step)
    }
    return { steps, manifestWritten: false, committed: 0 }
  }

  const persist = (entities: ManifestEntity[]): Promise<void> =>
    writeManifest(
      loaded.projectRoot,
      buildManifest({
        fakewareVersion: opts.fakewareVersion ?? '0.0.0',
        createdAt: opts.now ?? new Date().toISOString(),
        shopwareUrl: loaded.connection.url,
        entities,
      }),
    )

  const ledger: ManifestEntity[] = []
  let committed = 0

  for (const w of writes) {
    if (w.toWrite.length === 0) {
      ledger.push({ entity: w.entity, records: w.manifestRecords })
      reporter?.entityDone?.(w.step)
      continue
    }
    reporter?.entityStart?.(w.entity, w.toWrite.length)
    const confirmed = { entity: w.entity, records: w.manifestRecords }
    await persist([...ledger, { ...confirmed, pending: true }])
    try {
      await sink.write(w.entity, w.toWrite)
      if (w.entity === 'media' && sink.uploadMedia) {
        await sink.uploadMedia(w.toWrite, { projectRoot: loaded.projectRoot })
      }
    } catch (error) {
      reporter?.failed?.({
        entity: w.entity,
        committed: ledger.map((l) => l.entity),
        error: error as ShopwareApiError,
      })
      await persist(ledger)
      throw new ApplyStopped()
    }
    ledger.push(confirmed)
    committed += w.step.created + w.step.updated
    await persist(ledger)
    reporter?.entityDone?.(w.step)
  }

  return { steps, manifestWritten: ledger.length > 0, committed }
}

export async function runDown(opts: RunOptions): Promise<DownResult> {
  const { loaded } = opts
  const plugins = loaded.plugins
  const dryRun = opts.dryRun ?? false

  await runPluginHook(plugins, 'configResolved', 'configResolved', (plugin) =>
    configContextFor(opts, plugin),
  )

  const manifest = await readManifest(loaded.projectRoot, loaded.connection.url)
  if (!manifest) return { steps: [], reverted: false, failures: [] }

  const needsContext = plugins.some(
    (plugin) =>
      plugin.hooks?.contextReady || plugin.hooks?.beforeRevert || plugin.hooks?.afterRevert,
  )
  const shopContext = needsContext
    ? (opts.shopContext ??
      (await fetchShopContext(loaded.connection, collectFetchers(plugins), opts.client)))
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

  const stepFor = (entity: ManifestEntity): ReportStep => ({
    entity: entity.entity,
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: entity.records.length,
  })

  if (dryRun) {
    const steps = [...manifest.entities].reverse().map((entity) => {
      reporter?.entityStart?.(entity.entity, entity.records.length)
      const step = stepFor(entity)
      reporter?.entityDone?.(step)
      return step
    })
    return { steps, reverted: false, failures: [] }
  }

  const persist = (entities: ManifestEntity[]): Promise<void> =>
    writeManifest(
      loaded.projectRoot,
      buildManifest({
        fakewareVersion: opts.fakewareVersion ?? manifest.fakewareVersion,
        createdAt: manifest.createdAt,
        shopwareUrl: loaded.connection.url,
        entities,
      }),
    )

  const steps: ReportStep[] = []
  const deleted = new Set<string>()
  let remaining: ManifestEntity[] = [...manifest.entities].reverse()
  let lastError = new Map<string, ShopwareApiError>()

  while (remaining.length > 0) {
    const stillFailing: ManifestEntity[] = []
    const failedThisPass = new Map<string, ShopwareApiError>()
    let progressed = false

    for (const entity of remaining) {
      const ids = entity.records.map((r) => r.id)
      reporter?.entityStart?.(entity.entity, ids.length)
      await persist(
        manifest.entities
          .filter((e) => !deleted.has(e.entity))
          .map((e) => (e.entity === entity.entity ? { ...e, pending: true } : e)),
      )
      try {
        await sink.delete(entity.entity, ids)
      } catch (error) {
        if (!(error instanceof ShopwareApiError)) throw error
        stillFailing.push(entity)
        failedThisPass.set(entity.entity, error)
        await persist(manifest.entities.filter((e) => !deleted.has(e.entity)))
        continue
      }
      progressed = true
      deleted.add(entity.entity)
      const step = stepFor(entity)
      steps.push(step)
      reporter?.entityDone?.(step)
      await persist(manifest.entities.filter((e) => !deleted.has(e.entity)))
    }

    remaining = stillFailing
    lastError = failedThisPass
    if (!progressed) break
  }

  if (remaining.length === 0) {
    await removeManifest(loaded.projectRoot, loaded.connection.url)
    return { steps, reverted: true, failures: [] }
  }

  await persist(manifest.entities.filter((e) => !deleted.has(e.entity)))
  const committed = steps.map((s) => s.entity)
  const failures: ApplyFailure[] = remaining.map((entity) => {
    const error =
      lastError.get(entity.entity) ??
      new ShopwareApiError(`Could not delete ${entity.entity}.`, {
        status: null,
        entity: entity.entity,
        errors: [],
        retryable: false,
        cause: null,
      })
    reporter?.failed?.({ entity: entity.entity, committed, error })
    return { entity: entity.entity, committed, error }
  })
  return { steps, reverted: false, failures }
}
