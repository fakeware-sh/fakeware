import * as p from '@clack/prompts'
import { readManifest, runDown } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { createSyncSink } from '@fakeware/core/shopware'
import { Command } from 'commander'
import pc from 'picocolors'
import { promptConfirmDestroy, reportError } from '../prompts'

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

        const sink = createSyncSink(loaded.connection)
        const result = await runDown({
          loaded,
          sink,
          reporter: {
            onStep: (step) => p.log.step(`${pc.cyan(step.entity)} — ${step.deleted} deleted`),
          },
        })

        const deleted = result.steps.reduce((n, s) => n + s.deleted, 0)
        p.outro(
          `Removed ${pc.green(String(deleted))} record(s) from ${pc.cyan(loaded.connection.url)}.`,
        )
      } catch (error) {
        reportError(error)
      }
    })
}
