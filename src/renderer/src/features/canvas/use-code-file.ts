import type { FileContent } from '@shared/types'
import { useEffect, useState } from 'react'
import { useIpcQuery } from '../../lib/use-ipc-query'

// Conteúdo do arquivo de um bloco de código. Relê quando o arquivo muda no disco (o agente pode
// estar editando o mesmo arquivo).
export function useCodeFile(path: string | undefined) {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!path) return
    return window.api.fs.onChanged(({ events }) => {
      if (events.some((e) => e.path === path && e.type !== 'delete')) setVersion((v) => v + 1)
    })
  }, [path])
  return useIpcQuery<FileContent>(() => (path ? window.api.fs.readFile(path) : null), [path], {
    identity: path ?? '',
    refresh: version,
  })
}
