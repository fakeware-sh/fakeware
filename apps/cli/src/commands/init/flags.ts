import type { PackageManager } from '../../lib/package-manager'
import type { ScaffoldTemplate, SecretsDest } from '../../lib/scaffolding'

export interface InitFlags {
  url?: string
  clientId?: string
  clientSecret?: string
  output?: string
  template: ScaffoldTemplate
  secrets: SecretsDest
  packageManager?: PackageManager
  plugins?: string | false
  exampleData?: boolean
  install: boolean
  force: boolean
  yes?: boolean
  dryRun: boolean
}
