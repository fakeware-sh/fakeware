import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

const PUBLISHABLE = ['packages/core', 'apps/cli', 'apps/create-fakeware', 'plugins/plugin-pickware']

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function run(cmd: string, args: string[], cwd: string): RunResult {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function isPublished(name: string, version: string): boolean {
  const view = run('npm', ['view', `${name}@${version}`, 'version'], root)
  return view.status === 0 && view.stdout.trim().length > 0
}

let failed = false

for (const dir of PUBLISHABLE) {
  const cwd = join(root, dir)
  const pkg = (await Bun.file(join(cwd, 'package.json')).json()) as {
    name: string
    version: string
  }
  if (isPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version} (already on npm)`)
    continue
  }
  const dest = mkdtempSync(join(tmpdir(), 'fakeware-publish-'))
  const pack = run('bun', ['pm', 'pack', '--destination', dest], cwd)
  if (pack.status !== 0) {
    console.error(`pack failed for ${pkg.name}\n${pack.stdout}${pack.stderr}`)
    failed = true
    continue
  }
  const tarball = readdirSync(dest).find((file) => file.endsWith('.tgz'))
  if (!tarball) {
    console.error(`no tarball produced for ${pkg.name}`)
    failed = true
    continue
  }
  const publish = run('npm', ['publish', join(dest, tarball), '--access', 'public'], cwd)
  if (publish.status !== 0) {
    console.error(
      `publish failed for ${pkg.name}@${pkg.version}\n${publish.stdout}${publish.stderr}`,
    )
    failed = true
    continue
  }
  console.log(`published ${pkg.name}@${pkg.version}`)
}

if (failed) process.exit(1)
