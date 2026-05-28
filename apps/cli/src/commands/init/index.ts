import { Command } from 'commander'
import { assertOneOf } from '../../utils/validate'
import { PACKAGE_MANAGERS, runInit } from './run'
export function initCommand(): Command {
  return new Command('init')
    .description('Scaffold a project (package.json + typed config + .env) and install config types')
    .option('--url <url>', 'Shopware URL')
    .option('--client-id <id>', 'OAuth2 client ID')
    .option('--client-secret <secret>', 'OAuth2 client secret')
    .option('--scenario <name>', 'Starting scenario (recorded into config)')
    .option('--locale <locale>', 'Default locale')
    .option('--format <fmt>', 'ts | js | yaml | json', 'ts')
    .option('--output <path>', 'Directory to scaffold into (default: cwd)')
    .option('--secrets <dest>', 'env | inline | keychain', 'env')
    .option('--package-manager <pm>', 'bun | npm | pnpm | yarn (default: auto-detect)')
    .option('--no-install', 'Write files but skip dependency install')
    .option('--force', 'Overwrite existing files', false)
    .option('--yes', 'Accept defaults; never prompt')
    .action(async (opts) => {
      await runInit({
        url: opts.url,
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        scenario: opts.scenario,
        locale: opts.locale,
        format: opts.format,
        output: opts.output,
        secrets: opts.secrets,
        packageManager: opts.packageManager
          ? assertOneOf(opts.packageManager, PACKAGE_MANAGERS, '--package-manager')
          : undefined,
        install: opts.install,
        force: opts.force,
        yes: opts.yes,
      })
    })
}
