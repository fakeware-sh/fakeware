export const EXIT_OK = 0
export const EXIT_FAILURE = 1
export const EXIT_USAGE = 2
export const EXIT_CANCELLED = 130

export type ExitCode =
  | typeof EXIT_OK
  | typeof EXIT_FAILURE
  | typeof EXIT_USAGE
  | typeof EXIT_CANCELLED

export function exit(code: ExitCode): never {
  process.exit(code)
}
