import * as p from '@clack/prompts'
import { ShopwareConnectionError } from '@fakeware/core/shopware'

export async function validateWithSpinner(
  start: string,
  done: string,
  task: () => Promise<void>,
): Promise<ShopwareConnectionError | null> {
  const s = p.spinner()
  s.start(start)
  try {
    await task()
    s.stop(done)
    return null
  } catch (error) {
    if (error instanceof ShopwareConnectionError) {
      s.error(error.message)
      return error
    }
    s.error('Unexpected error.')
    throw error
  }
}
