import type { Command } from 'commander'

export function isVerbose(command: Command): boolean {
  return Boolean(command.optsWithGlobals().verbose)
}
