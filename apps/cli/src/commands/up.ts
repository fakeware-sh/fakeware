import * as p from '@clack/prompts'
import { type ReportStep, runUp } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { createSyncSink } from '@fakeware/core/shopware'
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
        const sink = createSyncSink(loaded.connection)
        const result = await runUp({
          loaded,
          sink,
          dryRun: opts.dryRun,
          fakewareVersion: pkg.version,
          reporter: spinnerReporter({ active: 'Applying', done: 'Applied' }, detail),
        })

        if (opts.dryRun) {
          p.outro('Dry run complete — nothing was written.')
          return
        }
        const total = result.steps.reduce((n, s) => n + s.created + s.updated, 0)
        const label = total === 1 ? 'change' : 'changes'
        p.outro(
          total === 0
            ? 'Already up to date — nothing changed.'
            : `Applied ${pc.green(String(total))} ${label} to ${pc.cyan(loaded.connection.url)}`,
        )
      } catch (error) {
        reportError(error)
      }
    })
}
