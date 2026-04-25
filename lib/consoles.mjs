import { consoleCollor, dafaultCollor, getProtoName } from '../lib/filter.mjs'
const CONSOLE = {
  _skip: ({ method, log }) => {
    console.error(
      consoleCollor((l => [l, `Skiped:${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor()
    )
  },
  _cation: ({ method, log, data = undefined }) => {
    console.error(
      consoleCollor((l => [l, `Cation:${method}()`, l].join('\n'))('='.repeat(100)), 1) + dafaultCollor(),
      { data, log }
    )
  },
  _error: ({ method, log, data = undefined }) => {
    console.error(
      consoleCollor((l => [l, `ERR:${method}()`, l].join('\n'))('='.repeat(100)), 2) + dafaultCollor(),
      { data, running: this.running, log }
    )
  }
}

export default { ...CONSOLE }
export const { _skip, _cation, _error } = CONSOLE

