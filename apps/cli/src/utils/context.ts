export type Verbosity = 'quiet' | 'normal' | 'verbose'

export interface OutputContext {
  verbosity: Verbosity
  json: boolean
}

export const output: OutputContext = {
  verbosity: 'normal',
  json: false,
}
