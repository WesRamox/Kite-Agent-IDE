/// <reference types="vite/client" />
import type { Api } from '@shared/ipc-contract'

declare global {
  interface Window {
    api: Api
  }
}
