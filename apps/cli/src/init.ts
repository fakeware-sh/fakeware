import { Option } from 'commander'
import { initCommand } from './commands/init'
import { applyNoColor } from './lib/no-color'

export { initCommand }

export interface RunInitOptions {
  name: string
  version: string
  argv?: string[]
}

export async function runInit({
  name,
  version,
  argv = process.argv.slice(2),
}: RunInitOptions): Promise<void> {
  applyNoColor(argv)

  await initCommand()
    .name(name)
    .version(version, '-V, --version', 'Show version')
    .addOption(new Option('--no-color', 'Disable ANSI colors'))
    .parseAsync(argv, { from: 'user' })
}
