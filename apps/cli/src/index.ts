#!/usr/bin/env node
import { Command, CommanderError, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { EXIT_OK, EXIT_USAGE, exit } from './lib/exit-codes'
import { applyNoColor } from './lib/no-color'

applyNoColor()

export async function buildProgram(): Promise<Command> {
  const { initCommand } = await import('./commands/init')
  const { upCommand } = await import('./commands/up')
  const { downCommand } = await import('./commands/down')
  const { statusCommand } = await import('./commands/status')
  const { validateCommand } = await import('./commands/validate')

  return new Command('fakeware')
    .description('Fill your Shopware shop with demo data.')
    .version(pkg.version, '-V, --version', 'Show version')
    .showHelpAfterError('(add --help for usage)')
    .configureHelp({ showGlobalOptions: true })
    .addOption(new Option('--no-color', 'Disable ANSI colors'))
    .addOption(new Option('--verbose', 'Show debug logs and full stack traces').default(false))
    .addCommand(initCommand())
    .addCommand(upCommand())
    .addCommand(downCommand())
    .addCommand(statusCommand())
    .addCommand(validateCommand())
}

const program = await buildProgram()
program.exitOverride()
for (const command of program.commands) command.exitOverride()

try {
  await program.parseAsync(process.argv)
} catch (error) {
  if (error instanceof CommanderError) {
    exit(error.exitCode === 0 ? EXIT_OK : EXIT_USAGE)
  }
  throw error
}
