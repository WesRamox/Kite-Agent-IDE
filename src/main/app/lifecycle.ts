import type { Logger } from '../lib/logger'
import type { Services } from './container'

// Tarefas em segundo plano que só existem com a janela aberta.
export function startBackground(services: Services, log: Logger): () => void {
  const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))
  services.hooksServices.claude.ensureWrapper().catch((err: unknown) => {
    log.warn('não foi possível criar o kite-hook.sh', { error: errorMessage(err) })
  })
  services.agentEvents.init().catch((err: unknown) => {
    log.warn('não foi possível ler o spool de agentes', { error: errorMessage(err) })
  })
  void services.agentService.init()
  services.canvasBridge.start().catch((err: unknown) => {
    log.warn('ferramentas do quadro indisponíveis', { error: errorMessage(err) })
  })
  const agentTicker = setInterval(() => services.agentService.tick(), 500)
  return () => clearInterval(agentTicker)
}

// Janela fechada: nenhum PTY, watcher ou timer pode sobrar (nada de processos órfãos).
export function disposeServices(services: Services): void {
  void services.agentService.shutdown()
  void services.agentEvents.dispose()
  void services.taskService.unwatch()
  services.ptyService.killAll()
  void services.watchService.unwatchAll()
  void services.gitWatchService.unwatchAll()
  void services.canvasBridge.stop()
}
