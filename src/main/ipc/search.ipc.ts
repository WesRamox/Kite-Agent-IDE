import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { SearchService } from '../services/search.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

const taskId = z.string().min(1).max(4200)
const query = z.object({
  text: z.string().min(1).max(1000),
  caseSensitive: z.boolean(),
  wholeWord: z.boolean(),
  regex: z.boolean(),
  include: z.string().max(2000),
  exclude: z.string().max(2000),
})

export function registerSearchIpc(search: SearchService, log: Logger): void {
  registerHandler(
    'search:task',
    z.tuple([absPath, taskId, query]),
    (r, id, q) => search.searchTask(r, id, q),
    log,
  )
}
