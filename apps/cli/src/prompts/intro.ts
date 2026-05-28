import * as p from '@clack/prompts'
import pc from 'picocolors'

export function introBanner(): void {
  p.intro(pc.bgCyan(pc.black(' Fakeware ')))
}
