import { buildConfigFile } from './config-file'
import { CONFIG_FILE_NAME, CORE_VERSION, hasShopConnection, type ScaffoldValues } from './values'

export type WriteStrategy = 'fresh' | 'merge'

export interface MergeResult {
  contents: string
  note: string
}

export interface FileSpec {
  name: string
  include: (values: ScaffoldValues) => boolean
  strategy: WriteStrategy
  build?: (values: ScaffoldValues) => string
  note?: (values: ScaffoldValues) => string
  merge?: (existing: string | undefined, values: ScaffoldValues) => MergeResult | null
}

const needsEnv = (values: ScaffoldValues): boolean =>
  values.secrets === 'env' && hasShopConnection(values)

function packageJsonTemplate(values: ScaffoldValues): string {
  const pkg = {
    name: values.projectName,
    private: true,
    type: 'module',
    devDependencies: {
      '@fakeware/core': CORE_VERSION,
    },
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

function envTemplate(values: ScaffoldValues): string {
  return [
    `SHOPWARE_URL=${values.url}`,
    `SHOPWARE_CLIENT_ID=${values.clientId}`,
    `SHOPWARE_CLIENT_SECRET=${values.clientSecret}`,
    '',
  ].join('\n')
}

function mergeGitignore(existing: string | undefined): MergeResult | null {
  if (existing === undefined) {
    return { contents: '.env\nnode_modules/\n', note: 'created (.env ignored)' }
  }
  const hasEnv = existing
    .split('\n')
    .some((line) => line.trim() === '.env' || line.trim() === '/.env')
  if (hasEnv) return null
  const sep = existing.endsWith('\n') || existing.length === 0 ? '' : '\n'
  return { contents: `${existing}${sep}.env\n`, note: 'updated (.env ignored)' }
}

export const FILE_SPECS: FileSpec[] = [
  {
    name: 'package.json',
    include: () => true,
    strategy: 'fresh',
    build: packageJsonTemplate,
    note: () => 'devDependency: @fakeware/core',
  },
  {
    name: CONFIG_FILE_NAME,
    include: () => true,
    strategy: 'fresh',
    build: buildConfigFile,
    note: () => 'typed via @fakeware/core/config',
  },
  {
    name: '.env',
    include: needsEnv,
    strategy: 'fresh',
    build: envTemplate,
    note: () => 'credentials',
  },
  {
    name: '.gitignore',
    include: needsEnv,
    strategy: 'merge',
    merge: mergeGitignore,
  },
]
