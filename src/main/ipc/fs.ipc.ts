import { z } from 'zod'
import type { Logger } from '../lib/logger'
import type { FsService } from '../services/fs.service'
import type { WatchService } from '../services/watch.service'
import { registerHandler } from './register'
import { absPath } from './schemas'

export function registerFsIpc(fs: FsService, watch: WatchService, log: Logger): void {
  registerHandler('fs:readDir', z.tuple([absPath]), (p) => fs.readDir(p), log)
  registerHandler('fs:readFile', z.tuple([absPath]), (p) => fs.readFile(p), log)
  registerHandler(
    'fs:writeFile',
    z.tuple([absPath, z.string(), z.enum(['utf8', 'utf8bom'])]),
    (p, content, encoding) => fs.writeFile(p, content, encoding),
    log,
  )
  registerHandler(
    'fs:create',
    z.tuple([absPath, z.enum(['file', 'directory'])]),
    (p, kind) => fs.create(p, kind),
    log,
  )
  registerHandler('fs:rename', z.tuple([absPath, absPath]), (a, b) => fs.rename(a, b), log)
  registerHandler('fs:delete', z.tuple([absPath]), (p) => fs.delete(p), log)
  registerHandler('fs:listFiles', z.tuple([absPath]), (root) => fs.listFiles(root), log)
  registerHandler('fs:watch', z.tuple([absPath]), (root) => watch.watch(root), log)
  registerHandler('fs:unwatch', z.tuple([absPath]), (root) => watch.unwatch(root), log)
}
