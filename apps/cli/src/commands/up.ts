import * as p from '@clack/prompts'
import { type ReportStep, runUp } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { createShopwareClient, createSyncSink } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import pkg from '../../package.json' with { type: 'json' }
import { counts, reportError, spinnerReporter } from '../prompts'

interface UpFlags {
  config?: string
  dryRun?: boolean
  verbose?: boolean
}

function detail(step: ReportStep): string {
  return counts(['+', step.created], ['~', step.updated], ['=', step.unchanged])
}

export function upCommand(): Command {
  return new Command('up')
    .description('Apply your data definitions to the shop')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--dry-run', 'Show what would change without writing', false)
    .option('--verbose', 'Show debug logs and full stack traces', false)
    .action(async (opts: UpFlags) => {
      p.intro(pc.bgCyan(pc.black(' fakeware up ')))
      try {
        const loaded = await loadConfig({ configFile: opts.config })
        const client = createShopwareClient(loaded.connection)
        const reporter = spinnerReporter({ active: 'Applying', done: 'Applied' }, detail)
        let result: Awaited<ReturnType<typeof runUp>>
        try {
          result = await runUp({
            loaded,
            client,
            sink: createSyncSink(loaded.connection, { client }),
            dryRun: opts.dryRun,
            debug: opts.verbose,
            fakewareVersion: pkg.version,
            reporter,
          })
        } finally {
          reporter.finish()
        }

        if (result.dataFiles === 0) {
          p.outro(
            `No data files found in ${pc.cyan('./data')}. Add one to describe what to create.`,
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
        reportError(error)
      }
    })
}
