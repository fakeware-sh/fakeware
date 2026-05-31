import * as p from '@clack/prompts'
import { ShopwareConnectionError } from '@fakeware/core/shopware'

export async function withSpinner<T>(
  start: string,
  done: string,
  task: () => Promise<T>,
): Promise<T> {
  const s = p.spinner()
  s.start(start)
  try {
    const result = await task()
    s.stop(done)
    return result
  } catch (error) {
    if (error instanceof ShopwareConnectionError) {
      s.error(error.message)
      p.cancel('Setup aborted — fix the issue above and run init again.')
      process.exit(1)
    }
    s.error('Unexpected error.')
    throw error
  }
}

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
