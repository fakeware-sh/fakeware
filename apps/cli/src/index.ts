#!/usr/bin/env node
if (process.argv.includes('--no-color')) {
  process.env.NO_COLOR = '1'
}

import { Command, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { output } from './utils/context'

export async function buildProgram(): Promise<Command> {
  const { initCommand } = await import('./commands/init')

  return new Command('fakeware')
    .description('Fill your Shopware shop with demo data.')
    .version(pkg.version, '-V, --version', 'Show version')
    .showHelpAfterError('(add --help for usage)')
    .configureHelp({ showGlobalOptions: true })
    .addOption(new Option('--verbose', 'Debug logging'))
    .addOption(new Option('--quiet', 'Errors only'))
    .addOption(new Option('--json', 'JSON output (for CI/scripting)'))
    .addOption(new Option('--no-color', 'Disable ANSI colors'))
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts<{ verbose?: boolean; quiet?: boolean; json?: boolean }>()
      output.verbosity = opts.verbose ? 'verbose' : opts.quiet ? 'quiet' : 'normal'
      output.json = opts.json ?? false
    })
    .addCommand(initCommand())
}

await (await buildProgram()).parseAsync(process.argv)
