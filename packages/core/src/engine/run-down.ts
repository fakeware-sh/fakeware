import { collectFetchers, dispatchOnError, PluginError, runPluginHook } from '../plugin'
import { apiError, fetchShopContext, ShopwareApiError } from '../shopware'
import {
  buildManifest,
  type Manifest,
  type ManifestEntity,
  readManifest,
  removeManifest,
  writeManifest,
} from './manifest'
import { configContextFor, pluginContextFor } from './plugin-dispatch'
import type { ApplyFailure, DownResult, ReportStep, RunOptions } from './types'

export async function runDown(opts: RunOptions): Promise<DownResult> {
  const { loaded } = opts
  const plugins = loaded.plugins
  const dryRun = opts.dryRun ?? false

  await runPluginHook(plugins, 'configResolved', 'configResolved', (plugin) =>
    configContextFor(opts, plugin),
  )

  try {
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
      await runPluginHook(
        plugins,
        'afterRevert',
        'afterRevert',
        (plugin) => ({ ...pluginContextFor(opts, plugin, shopContext), dryRun }),
        result,
      )
    }

    return result
  } catch (error) {
    if (!(error instanceof PluginError)) {
      await dispatchOnError(plugins, 'revert', error, (plugin) => configContextFor(opts, plugin))
    }
    throw error
  }
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
      apiError(`Could not delete ${entity.entity}.`, { entity: entity.entity })
    reporter?.failed?.({ entity: entity.entity, committed, error })
    return { entity: entity.entity, committed, error }
  })
  return { steps, reverted: false, failures }
}
