import * as p from '@clack/prompts'
import { validateProject } from '@fakeware/core'
import { loadConfig } from '@fakeware/core/config'
import { Command } from 'commander'
import pc from 'picocolors'
import { EXIT_FAILURE, exit } from '../../lib/exit-codes'
import { toJsonError, writeJson } from '../../lib/json-output'
import { isVerbose } from '../../lib/verbose'
import { reportError } from '../../prompts'
import { renderChecklist, renderCheckWarnings, renderIssues } from './render'

interface ValidateFlags {
  config?: string
  shopChecks?: boolean
  json?: boolean
}

async function runJson(opts: ValidateFlags, verbose: boolean): Promise<void> {
  try {
    const loaded = await loadConfig({ configFile: opts.config })
    const result = await validateProject(loaded, { offline: opts.shopChecks === false })
    writeJson(result)
    if (!result.ok) exit(EXIT_FAILURE)
  } catch (error) {
    writeJson(toJsonError(error, verbose))
    exit(EXIT_FAILURE)
  }
}

export function validateCommand(): Command {
  return new Command('validate')
    .description('Check your config and data files for errors')
    .option('--config <path>', 'Path to fakeware.config.ts')
    .option('--no-shop-checks', 'Skip the plugin checks that contact the shop')
    .option('--json', 'Print the result as JSON', false)
    .action(async (opts: ValidateFlags, command: Command) => {
      if (opts.json) return runJson(opts, isVerbose(command))

      p.intro(pc.bgCyan(pc.black(' fakeware validate ')))
      try {
        const loaded = await loadConfig({ configFile: opts.config })
        const result = await validateProject(loaded, { offline: opts.shopChecks === false })

        p.log.message(renderChecklist(result))

        const warnings = renderCheckWarnings(result)
        if (warnings !== '') p.log.warn(warnings)

        if (!result.ok) {
          p.log.message(renderIssues(result))
          const n = result.issues.length
          p.cancel(`Found ${n} ${n === 1 ? 'problem' : 'problems'}.`)
          exit(EXIT_FAILURE)
        }

        if (result.dataFiles.length === 0) {
          p.outro(
            `No data files matched ${pc.cyan(loaded.config.include.join(', '))}. Add one to describe what to create.`,
          )
          return
        }

        if (result.shopDependent !== null) {
          p.log.warn(
            `Stopped short of the reference and graph checks because your data reads live shop values:\n${pc.dim('-')} ${result.shopDependent.trim()}`,
          )
        }

        const next =
          result.skipReason === 'noConnection'
            ? `Configure your shop credentials to also check plugin requirements.`
            : `Shop values are checked on ${pc.cyan('fakeware up')}.`
        p.outro(
          `Looks good: ${pc.green(String(result.records))} records across ${pc.green(String(result.entities.length))} entities. ${next}`,
        )
      } catch (error) {
        reportError(error, isVerbose(command))
      }
    })
}
