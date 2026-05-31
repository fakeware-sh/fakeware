#!/usr/bin/env node
import { Command, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { applyNoColor } from './lib/no-color'

applyNoColor()

export async function buildProgram(): Promise<Command> {
  const { initCommand } = await import('./commands/init')
  const { upCommand } = await import('./commands/up')
  const { downCommand } = await import('./commands/down')

  return new Command('fakeware')
    .description('Fill your Shopware shop with demo data.')
    .version(pkg.version, '-V, --version', 'Show version')
    .showHelpAfterError('(add --help for usage)')
    .configureHelp({ showGlobalOptions: true })
    .addOption(new Option('--no-color', 'Disable ANSI colors'))
    .addCommand(initCommand())
    .addCommand(upCommand())
    .addCommand(downCommand())
}

await (await buildProgram()).parseAsync(process.argv)
