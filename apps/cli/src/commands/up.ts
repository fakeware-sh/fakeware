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
}

function detail(step: ReportStep): string {
  return counts(['+', step.created], ['~', step.updated], ['=', step.unchanged])
}

export function upCommand(): Command {
  return new Command('up')
    .description('Apply your data definitions to the shop')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--dry-run', 'Show what would change without writing', false)
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
            fakewareVersion: pkg.version,
            reporter,
          })
        } finally {
          reporter.finish()
        }

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
