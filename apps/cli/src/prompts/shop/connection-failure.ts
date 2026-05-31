import * as p from '@clack/prompts'
import { cancelable } from '../cancel'

export type ConnectionFailureChoice = 'retry' | 'edit' | 'skip' | 'cancel'

export async function promptConnectionFailure(): Promise<ConnectionFailureChoice> {
  return cancelable(
    await p.select<ConnectionFailureChoice>({
      message: 'Connection failed. What would you like to do?',
      initialValue: 'edit',
      options: [
        { value: 'retry', label: 'Retry', hint: 'try the same details again' },
        { value: 'edit', label: 'Re-enter connection details' },
        { value: 'skip', label: 'Skip — connect later' },
        { value: 'cancel', label: 'Cancel' },
      ],
    }),
  )
}
