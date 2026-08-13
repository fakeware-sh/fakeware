import { buildConfigFile } from './config-file'
import { pluginReadme, pluginSource, pluginTest } from './plugin-template'
import {
  CONFIG_FILE_NAME,
  hasShopConnection,
  isPluginTemplate,
  isProjectTemplate,
  type ScaffoldValues,
} from './values'
import {
  BUN_TYPES_VERSION,
  corePeerRange,
  SCAFFOLD_DEPENDENCIES,
  scaffoldDependencies,
  TYPESCRIPT_VERSION,
} from './versions'

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
    devDependencies: scaffoldDependencies(values.plugins),
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

function pluginPackageJsonTemplate(values: ScaffoldValues): string {
  const pkg = {
    name: values.projectName,
    version: '0.0.0',
    type: 'module',
    main: './src/index.ts',
    files: ['src'],
    scripts: {
      test: 'bun test',
      typecheck: 'tsc --noEmit',
    },
    peerDependencies: {
      '@fakeware/core': corePeerRange(),
    },
    devDependencies: {
      '@fakeware/core': SCAFFOLD_DEPENDENCIES['@fakeware/core'],
      '@types/bun': BUN_TYPES_VERSION,
      typescript: TYPESCRIPT_VERSION,
    },
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
    strict: true,
    noUncheckedIndexedAccess: true,
    noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
  },
  include: ['**/*.ts'],
}

function tsconfigTemplate(): string {
  return `${JSON.stringify(TSCONFIG, null, 2)}\n`
}

function pluginTsconfigTemplate(): string {
  const config = {
    ...TSCONFIG,
    compilerOptions: { ...TSCONFIG.compilerOptions, types: ['bun'] },
    include: ['src'],
  }
  return `${JSON.stringify(config, null, 2)}\n`
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
    include: isProjectTemplate,
    strategy: 'fresh',
    build: packageJsonTemplate,
    note: () => 'devDependency: @fakeware/core',
  },
  {
    name: 'package.json',
    include: isPluginTemplate,
    strategy: 'fresh',
    build: pluginPackageJsonTemplate,
    note: () => 'peerDependency: @fakeware/core',
  },
  {
    name: 'tsconfig.json',
    include: isProjectTemplate,
    strategy: 'fresh',
    build: tsconfigTemplate,
    note: () => 'editor IntelliSense + type checking',
  },
  {
    name: 'tsconfig.json',
    include: isPluginTemplate,
    strategy: 'fresh',
    build: pluginTsconfigTemplate,
    note: () => 'strict type checking with bun types',
  },
  {
    name: CONFIG_FILE_NAME,
    include: isProjectTemplate,
    strategy: 'fresh',
    build: buildConfigFile,
    note: () => 'typed via @fakeware/core/config',
  },
  {
    name: 'src/index.ts',
    include: isPluginTemplate,
    strategy: 'fresh',
    build: pluginSource,
    note: () => 'definePlugin + example fetcher',
  },
  {
    name: 'src/index.test.ts',
    include: isPluginTemplate,
    strategy: 'fresh',
    build: pluginTest,
    note: () => 'createTestClient + createTestPluginContext',
  },
  {
    name: 'README.md',
    include: isPluginTemplate,
    strategy: 'fresh',
    build: pluginReadme,
    note: () => 'usage + publishing checklist',
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
