import { describe, expect, test } from 'bun:test'
import { Command, Option } from 'commander'
import { isVerbose } from './verbose'

function program(): { root: Command; seen: () => boolean } {
  let seen = false
  const root = new Command('fakeware')
    .addOption(new Option('--verbose').default(false))
    .exitOverride()
  root.addCommand(
    new Command('up')
      .option('--config <path>')
      .option('--verbose', '', false)
      .action((_opts, command: Command) => {
        seen = isVerbose(command)
      }),
  )
  root.addCommand(
    new Command('status').option('--config <path>').action((_opts, command: Command) => {
      seen = isVerbose(command)
    }),
  )
  return { root, seen: () => seen }
}

describe('isVerbose', () => {
  test('reads --verbose declared on the subcommand', async () => {
    const { root, seen } = program()
    await root.parseAsync(['up', '--verbose'], { from: 'user' })
    expect(seen()).toBe(true)
  })

  test('reads --verbose declared on the root, before the subcommand', async () => {
    const { root, seen } = program()
    await root.parseAsync(['--verbose', 'up'], { from: 'user' })
    expect(seen()).toBe(true)
  })

  test('reaches a subcommand that declares no --verbose of its own', async () => {
    const { root, seen } = program()
    await root.parseAsync(['--verbose', 'status'], { from: 'user' })
    expect(seen()).toBe(true)
  })

  test('is false when the flag is absent', async () => {
    const { root, seen } = program()
    await root.parseAsync(['up'], { from: 'user' })
    expect(seen()).toBe(false)
  })

  test('ignores a --verbose that is an option value, not a flag', async () => {
    const { root, seen } = program()
    await root.parseAsync(['up', '--config', '--verbose.ts'], { from: 'user' })
    expect(seen()).toBe(false)
  })
})
