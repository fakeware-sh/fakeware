import * as p from '@clack/prompts'
import pc from 'picocolors'
import { cancelable } from './cancel'

export async function promptConfirmDestroy(count: number, url: string): Promise<boolean> {
  return cancelable(
    await p.confirm({
      message: `Delete ${pc.red(String(count))} record(s) created by fakeware from ${pc.cyan(url)}?`,
      initialValue: false,
    }),
  )
}
