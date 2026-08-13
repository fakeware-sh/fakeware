import * as p from '@clack/prompts'
import { cancelable } from '../cancel'

export async function promptExampleData(): Promise<boolean> {
  return cancelable(
    await p.select<boolean>({
      message: 'Include an example data file?',
      initialValue: true,
      options: [
        {
          value: true,
          label: 'Yes, add data/products.ts',
          hint: 'a tax rate and 10 demo products, so the first `fakeware up` does something',
        },
        { value: false, label: 'No, start empty' },
      ],
    }),
  )
}
