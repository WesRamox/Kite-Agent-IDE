import type { AppInfo } from '@shared/types'
import { useIpcQuery } from './use-ipc-query'

export function useAppInfo(): AppInfo | null {
  return useIpcQuery(() => window.api.app.getInfo(), []).data
}
