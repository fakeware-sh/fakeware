import * as p from '@clack/prompts'
import pc from 'picocolors'
import { cancelable } from '../cancel'

export type ExistingDirChoice = 'remove' | 'ignore' | 'cancel'

export async function promptExistingDir(dir: string): Promise<ExistingDirChoice> {
  return cancelable(
    await p.select<ExistingDirChoice>({
      message: `${pc.cyan(dir)} is not empty. How should we proceed?`,
      initialValue: 'cancel',
      options: [
        { value: 'remove', label: 'Remove existing files and continue' },
        { value: 'ignore', label: 'Ignore files and continue', hint: 'may overwrite' },
        { value: 'cancel', label: 'Cancel' },
      ],
    }),
  )
}
