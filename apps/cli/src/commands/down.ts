import * as p from '@clack/prompts'
import { readManifest, runDown } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { createShopwareClient, createSyncSink } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import { counts, promptConfirmDestroy, reportError, spinnerReporter } from '../prompts'

interface DownFlags {
  config?: string
  yes?: boolean
}

export function downCommand(): Command {
  return new Command('down')
    .description('Delete the demo data fakeware created, per its manifest')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--yes', 'Skip the confirmation prompt')
    .action(async (opts: DownFlags) => {
      p.intro(pc.bgYellow(pc.black(' fakeware down ')))
      try {
        const loaded = await loadConfig({ configFile: opts.config })

        const manifest = await readManifest(loaded.projectRoot, loaded.connection.url)
        if (!manifest) {
          p.outro('Nothing to revert — no fakeware manifest found.')
          return
        }
        const count = manifest.entities.reduce((n, e) => n + e.records.length, 0)

        if (!opts.yes) {
          const proceed = await promptConfirmDestroy(count, loaded.connection.url)
          if (!proceed) {
            p.cancel('Aborted — nothing was deleted.')
            process.exit(0)
          }
        }

        const client = createShopwareClient(loaded.connection)
        const reporter = spinnerReporter({ active: 'Removing', done: 'Removed' }, (step) =>
          counts(['-', step.deleted]),
        )
        let result: Awaited<ReturnType<typeof runDown>>
        try {
          result = await runDown({
            loaded,
            client,
            sink: createSyncSink(loaded.connection, { client }),
            reporter,
          })
        } finally {
          reporter.finish()
        }

        const deleted = result.steps.reduce((n, s) => n + s.deleted, 0)
        const label = deleted === 1 ? 'record' : 'records'
        const where = pc.cyan(loaded.connection.url)
        if (result.failures.length > 0) {
          const failed = result.failures.map((f) => pc.cyan(f.entity)).join(', ')
          p.outro(
            `Removed ${pc.green(String(deleted))} ${label} from ${where}. ${pc.red(`Failed to remove ${result.failures.length}`)}: ${failed}.`,
          )
          process.exitCode = 1
          return
        }
        p.outro(`Removed ${pc.green(String(deleted))} ${label} from ${where}`)
      } catch (error) {
        reportError(error)
      }
    })
}
