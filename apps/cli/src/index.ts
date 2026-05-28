#!/usr/bin/env node
if (process.argv.includes('--no-color')) {
  process.env.NO_COLOR = '1'
}

import { Command, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }

export async function buildProgram(): Promise<Command> {
  const { initCommand } = await import('./commands/init')

  return new Command('fakeware')
    .description('Fill your Shopware shop with demo data.')
    .version(pkg.version, '-V, --version', 'Show version')
    .showHelpAfterError('(add --help for usage)')
    .configureHelp({ showGlobalOptions: true })
    .addOption(new Option('--no-color', 'Disable ANSI colors'))
    .addCommand(initCommand())
}

await (await buildProgram()).parseAsync(process.argv)
