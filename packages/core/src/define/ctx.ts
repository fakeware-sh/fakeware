export interface Ctx {
  index: number
  count: number
  ref(path: string): string
  refs(entity: string): string[]
}
