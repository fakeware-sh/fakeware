import * as p from '@clack/prompts'
import { cancelable } from '../cancel'

export async function promptConnectNow(): Promise<boolean> {
  return cancelable(
    await p.select<boolean>({
      message: 'Connect a Shopware shop now?',
      initialValue: true,
      options: [
        {
          value: true,
          label: 'Yes, connect now',
        },
        { value: false, label: 'Later' },
      ],
    }),
  )
}
