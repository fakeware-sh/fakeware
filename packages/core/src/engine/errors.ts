export class GraphError extends Error {}

export class ApplyStopped extends Error {
  constructor() {
    super('apply stopped')
    this.name = 'ApplyStopped'
  }
}
