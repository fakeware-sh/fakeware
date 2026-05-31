export function applyNoColor(argv: string[] = process.argv): void {
  if (argv.includes('--no-color') || process.env.NO_COLOR) {
    process.env.NO_COLOR = '1'
  }
}
