import * as p from '@clack/prompts'
import { readManifest } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { Command } from 'commander'
import pc from 'picocolors'
import { reportError } from '../../prompts'
import { renderEntities, renderSummary } from './render'
import { buildReport, pendingEntities, type StatusReport } from './report'

interface StatusFlags {
  config?: string
  json?: boolean
}

async function collect(flags: StatusFlags): Promise<StatusReport> {
  const loaded = await loadConfig({ configFile: flags.config })
  const manifest = await readManifest(loaded.projectRoot, loaded.connection.url)
  return buildReport(
    {
      shopwareUrl: loaded.connection.url,
      configPath: loaded.configPath,
      plugins: loaded.plugins.map((plugin) => plugin.name),
    },
    manifest,
  )
}

function print(report: StatusReport): void {
  p.log.message(renderSummary(report))

  if (!report.manifest) {
    p.outro(`No data applied yet. Run ${pc.cyan('fakeware up')} to create some.`)
    return
  }

  p.log.message(renderEntities(report.manifest.entities))

  const pending = pendingEntities(report)
  if (pending.length > 0) {
    const list = pending.map((entity) => pc.cyan(entity)).join(', ')
    p.log.warn(
      `Unconfirmed after an interrupted run: ${list}. The next ${pc.cyan('fakeware up')} re-applies them.`,
    )
  }

  const { records, entities } = report.manifest
  const recordLabel = records === 1 ? 'record' : 'records'
  const entityLabel = entities.length === 1 ? 'entity' : 'entities'
  p.outro(
    `${pc.green(String(records))} ${recordLabel} across ${pc.green(String(entities.length))} ${entityLabel}.`,
  )
}

export function statusCommand(): Command {
  return new Command('status')
    .description('Show what fakeware has applied to the shop, from the local manifest')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--json', 'Print the status as JSON', false)
    .action(async (opts: StatusFlags) => {
      if (opts.json) {
        try {
          process.stdout.write(`${JSON.stringify(await collect(opts), null, 2)}\n`)
        } catch (error) {
          reportError(error)
        }
        return
      }

      p.intro(pc.bgCyan(pc.black(' fakeware status ')))
      try {
        print(await collect(opts))
      } catch (error) {
        reportError(error)
      }
    })
}
