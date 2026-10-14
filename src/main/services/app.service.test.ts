import { describe, expect, it } from 'vitest'
import { AppService } from './app.service'

describe('AppService', () => {
  it('retorna as informações injetadas', () => {
    const deps = {
      name: 'Kite',
      version: '0.1.0',
      platform: 'linux',
      versions: { electron: '44', chrome: '140', node: '24' },
    }
    expect(new AppService(deps).getInfo()).toEqual(deps)
  })
})
