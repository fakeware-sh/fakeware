import { access, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function isEmptyDir(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path)
    return entries.length === 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
}

export async function emptyDir(path: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  await Promise.all(entries.map((entry) => rm(join(path, entry), { recursive: true, force: true })))
}
