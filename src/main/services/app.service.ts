import type { AppInfo } from '@shared/types'

export interface AppServiceDeps {
  name: string
  version: string
  platform: string
  versions: AppInfo['versions']
}

export class AppService {
  constructor(private readonly deps: AppServiceDeps) {}

  getInfo(): AppInfo {
    const { name, version, platform, versions } = this.deps
    return { name, version, platform, versions: { ...versions } }
  }
}
