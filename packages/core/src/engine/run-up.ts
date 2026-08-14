import { createRegistry } from '../define'
import type { SinkRecord } from '../domain'
import {
  collectFetchers,
  dispatchOnError,
  PluginCheckError,
  PluginError,
  runPluginHook,
} from '../plugin'
import { createModuleLoader } from '../runtime'
import { fetchShopContext, type ShopContext, ShopwareApiError, toApiError } from '../shopware'
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
  writeManifest,
} from './manifest'
import { configContextFor, gateOnChecks, pluginContextFor } from './plugin-dispatch'
import type { EntityWrite, RunOptions, UpResult } from './types'

function priorHashes(manifest: Manifest | null): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>()
  for (const e of manifest?.entities ?? []) {
    if (e.pending) continue
    map.set(e.entity, new Map(e.records.map((r) => [r.id, r.hash])))
  }
  return map
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
  const manifestRecords: ManifestRecord[] = records.map(({ record, hash }) => {
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

  try {
    let shopContext = opts.shopContext
    if (!shopContext) {
      const client = await gateOnChecks(opts)
      shopContext = await fetchShopContext(loaded.connection, collectFetchers(plugins), client)
    }

    await runPluginHook(plugins, 'contextReady', 'contextReady', (plugin) =>
      pluginContextFor(opts, plugin, shopContext),
    )
    await runPluginHook(plugins, 'beforeApply', 'beforeApply', (plugin) => ({
      ...pluginContextFor(opts, plugin, shopContext),
      dryRun,
    }))

    const result = await applyPlan(opts, shopContext)

    await runPluginHook(
      plugins,
      'afterApply',
      'afterApply',
      (plugin) => ({ ...pluginContextFor(opts, plugin, shopContext), dryRun }),
      result,
    )

    return result
  } catch (error) {
    if (
      !(error instanceof PluginError) &&
      !(error instanceof ApplyStopped) &&
      !(error instanceof PluginCheckError)
    ) {
      await dispatchOnError(plugins, 'apply', error, (plugin) => configContextFor(opts, plugin))
    }
    throw error
  }
}

async function applyPlan(opts: RunOptions, shopContext: ShopContext): Promise<UpResult> {
  const { loaded, sink, dryRun, reporter } = opts
  const files = await discoverDataFiles(loaded.projectRoot)
  const drained = await evaluateDataFiles(files, createRegistry(), createModuleLoader())
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
    return { steps, manifestWritten: false, committed: 0, dataFiles: files.length }
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
      if (sink.uploadMedia) {
        await sink.uploadMedia(w.toWrite, { projectRoot: loaded.projectRoot })
      }
    } catch (error) {
      const failure =
        error instanceof ShopwareApiError ? error : toApiError(w.entity, w.toWrite, error)
      reporter?.failed?.({
        entity: w.entity,
        committed: ledger.map((l) => l.entity),
        error: failure,
      })
      await persist(ledger)
      await dispatchOnError(loaded.plugins, 'apply', failure, (plugin) =>
        pluginContextFor(opts, plugin, shopContext),
      )
      throw new ApplyStopped()
    }
    ledger.push(confirmed)
    committed += w.step.created + w.step.updated
    await persist(ledger)
    reporter?.entityDone?.(w.step)
  }

  return { steps, manifestWritten: ledger.length > 0, committed, dataFiles: files.length }
}
