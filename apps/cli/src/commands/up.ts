import * as p from '@clack/prompts'
import { type Reporter, type ReportStep, runUp, type UpResult } from '@fakeware/core'
import { type LoadedConfig, loadConfig } from '@fakeware/core/config'
import { createShopwareClient, createSyncSink } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT_FAILURE, exit } from '../lib/exit-codes'
import { toJsonError, writeJson } from '../lib/json-output'
import { isVerbose } from '../lib/verbose'
import { counts, reportError, spinnerReporter } from '../prompts'

interface UpFlags {
  config?: string
  dryRun?: boolean
  json?: boolean
  verbose?: boolean
}

function detail(step: ReportStep): string {
  return counts(['+', step.created], ['~', step.updated], ['=', step.unchanged])
}

async function apply(
  loaded: LoadedConfig,
  opts: UpFlags,
  verbose: boolean,
  reporter?: Reporter,
): Promise<UpResult> {
  const client = createShopwareClient(loaded.connection)
  return runUp({
    loaded,
    client,
    sink: createSyncSink(loaded.connection, { client }),
    dryRun: opts.dryRun,
    verbose,
    fakewareVersion: pkg.version,
    reporter,
  })
}

async function runJson(opts: UpFlags, verbose: boolean): Promise<void> {
  try {
    const loaded = await loadConfig({ configFile: opts.config })
    writeJson(await apply(loaded, opts, verbose))
  } catch (error) {
    writeJson(toJsonError(error, verbose))
    exit(EXIT_FAILURE)
  }
}

export function upCommand(): Command {
  return new Command('up')
    .description('Apply your data definitions to the shop')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--dry-run', 'Show what would change without writing', false)
    .option('--json', 'Print the result as JSON', false)
    .option('--verbose', 'Show debug logs and full stack traces', false)
    .action(async (opts: UpFlags, command: Command) => {
      if (opts.json) return runJson(opts, isVerbose(command))

      p.intro(pc.bgCyan(pc.black(' fakeware up ')))
      try {
        const loaded = await loadConfig({ configFile: opts.config })
        const reporter = spinnerReporter({ active: 'Applying', done: 'Applied' }, detail)
        let result: UpResult
        try {
          result = await apply(loaded, opts, isVerbose(command), reporter)
        } finally {
          reporter.finish()
        }

        if (result.dataFiles === 0) {
          p.outro(
            `No data files matched ${pc.cyan(loaded.config.include.join(', '))}. Add one to describe what to create.`,
          )
          return
        }
        if (opts.dryRun) {
          p.outro('Dry run complete. Nothing was written.')
          return
        }
        if (result.committed === 0) {
          p.outro('Already up to date. Nothing changed.')
          return
        }
        const label = result.committed === 1 ? 'change' : 'changes'
        const where = pc.cyan(loaded.connection.url)
        p.outro(`Committed ${pc.green(String(result.committed))} ${label} to ${where}`)
      } catch (error) {
        reportError(error, isVerbose(command))
      }
    })
}
