import { buildConfigFile } from './config-file'
import { CONFIG_FILE_NAME, hasShopConnection, type ScaffoldValues } from './values'
import { SCAFFOLD_DEPENDENCIES } from './versions'

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
    devDependencies: { ...SCAFFOLD_DEPENDENCIES },
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

const TSCONFIG = {
  $schema: 'https://json.schemastore.org/tsconfig',
  compilerOptions: {
    target: 'esnext',
    module: 'preserve',
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    lib: ['esnext'],
    types: ['node'],
    strict: true,
    noUncheckedIndexedAccess: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  },
  include: ['**/*.ts'],
}

function tsconfigTemplate(): string {
  return `${JSON.stringify(TSCONFIG, null, 2)}\n`
}

function envTemplate(values: ScaffoldValues): string {
  return [
    `SHOPWARE_URL=${values.url}`,
    `SHOPWARE_CLIENT_ID=${values.clientId}`,
    `SHOPWARE_CLIENT_SECRET=${values.clientSecret}`,
    '',
  ].join('\n')
}

function mergeGitignore(existing: string | undefined, values: ScaffoldValues): MergeResult | null {
  const wanted = ['node_modules/', '.fakeware/']
  if (needsEnv(values)) wanted.unshift('.env')

  if (existing === undefined) {
    return { contents: `${wanted.join('\n')}\n`, note: `created (${wanted.join(', ')} ignored)` }
  }
  const lines = existing.split('\n').map((line) => line.trim())
  const missing = wanted.filter((entry) => !lines.includes(entry) && !lines.includes(`/${entry}`))
  if (missing.length === 0) return null
  const sep = existing.endsWith('\n') || existing.length === 0 ? '' : '\n'
  return {
    contents: `${existing}${sep}${missing.map((entry) => `${entry}\n`).join('')}`,
    note: `updated (${missing.join(', ')} ignored)`,
  }
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
    name: 'tsconfig.json',
    include: () => true,
    strategy: 'fresh',
    build: tsconfigTemplate,
    note: () => 'editor IntelliSense + type checking',
  },
  {
    name: CONFIG_FILE_NAME,
    include: () => true,
    strategy: 'fresh',
    build: buildConfigFile,
    note: () => 'typed via @fakeware/core/config',
  },
  {
    name: '.gitignore',
    include: () => true,
    strategy: 'merge',
    merge: mergeGitignore,
  },
  {
    name: '.env',
    include: needsEnv,
    strategy: 'fresh',
    build: envTemplate,
    note: () => 'credentials',
  },
]
