import * as p from '@clack/prompts'
import { PACKAGE_MANAGERS, type PackageManager } from '../../lib/package-manager'
import { cancelable } from '../cancel'

export async function promptPackageManager(preselected: PackageManager): Promise<PackageManager> {
  return cancelable(
    await p.select<PackageManager>({
      message: 'Which package manager should install dependencies?',
      initialValue: preselected,
      options: PACKAGE_MANAGERS.map((value) => ({
        value,
        label: value,
        hint: value === preselected ? 'detected' : undefined,
      })),
    }),
  )
}
