import * as p from '@clack/prompts'
import { cancelable } from '../cancel'

export async function promptProjectLocation(prefill?: string): Promise<string> {
  if (prefill) return prefill

  return cancelable(
    await p.text({
      message: 'Where should the project be created?',
      initialValue: './',
      validate: (value) =>
        !value || value.trim().length === 0 ? 'Enter a directory path' : undefined,
    }),
  )
}
