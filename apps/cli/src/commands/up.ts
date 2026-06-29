import * as p from '@clack/prompts'
import { type OnError, type ReportStep, runUp } from '@fakeware/core'
import { ConfigError, loadConfig } from '@fakeware/core/config'
import { createSyncSink } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import pkg from '../../package.json' with { type: 'json' }
import { counts, pluginLogSink, reportError, spinnerReporter } from '../prompts'

interface UpFlags {
  config?: string
  dryRun?: boolean
  atomic?: boolean
  onError?: string
}

const ON_ERROR_POLICIES: OnError[] = ['rollback', 'continue', 'stop']

function detail(step: ReportStep): string {
  return counts(['+', step.created], ['~', step.updated], ['=', step.unchanged])
}

function resolveOnError(flag: string | undefined, fallback: OnError): OnError {
  if (flag === undefined) return fallback
  if (!ON_ERROR_POLICIES.includes(flag as OnError)) {
    throw new ConfigError(
      `Invalid --on-error value "${flag}". Use one of: ${ON_ERROR_POLICIES.join(', ')}.`,
    )
  }
  return flag as OnError
}

export function upCommand(): Command {
  return new Command('up')
    .description('Apply your data definitions to the shop')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--dry-run', 'Show what would change without writing', false)
    .option('--atomic', 'Force single-request atomic sync')
    .option('--no-atomic', 'Disable atomic sync; use the saga fallback')
    .option('--on-error <policy>', 'On failure: rollback | continue | stop')
    .action(async (opts: UpFlags) => {
      p.intro(pc.bgCyan(pc.black(' fakeware up ')))
      try {
        const loaded = await loadConfig({ configFile: opts.config })
        const onError = resolveOnError(opts.onError, loaded.config.transaction.onError)
        const atomic = opts.atomic ?? loaded.config.transaction.atomic

        const sink = createSyncSink(loaded.connection)
        const result = await runUp({
          loaded,
          sink,
          dryRun: opts.dryRun,
          fakewareVersion: pkg.version,
          transaction: { onError, atomic },
          logSink: pluginLogSink(),
          reporter: spinnerReporter({ active: 'Applying', done: 'Applied' }, detail),
        })

        if (opts.dryRun) {
          p.outro('Dry run complete — nothing was written.')
          return
        }
        if (result.committed === 0) {
          p.outro('Already up to date — nothing changed.')
          return
        }
        const label = result.committed === 1 ? 'change' : 'changes'
        const where = pc.cyan(loaded.connection.url)
        p.outro(`Committed ${pc.green(String(result.committed))} ${label} to ${where}`)
      } catch (error) {
        reportError(error)
      }
    })
}
