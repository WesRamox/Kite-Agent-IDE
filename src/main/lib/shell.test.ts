import { describe, expect, it } from 'vitest'
import { defaultShell, terminalEnv } from './shell'

describe('defaultShell', () => {
  it('usa $SHELL no Linux, sem login shell', () => {
    expect(
      defaultShell({ platform: 'linux', env: { SHELL: '/usr/bin/fish' }, which: () => null }),
    ).toEqual({ file: '/usr/bin/fish', args: [] })
  })

  it('cai em /bin/bash no Linux e /bin/zsh -l no macOS', () => {
    expect(defaultShell({ platform: 'linux', env: {}, which: () => null }).file).toBe('/bin/bash')
    expect(defaultShell({ platform: 'darwin', env: {}, which: () => null })).toEqual({
      file: '/bin/zsh',
      args: ['-l'],
    })
  })

  it('prefere pwsh no Windows e cai no powershell embutido', () => {
    const withPwsh = defaultShell({
      platform: 'win32',
      env: {},
      which: (n) => (n === 'pwsh.exe' ? 'C:\\pwsh\\pwsh.exe' : null),
    })
    expect(withPwsh.file).toBe('C:\\pwsh\\pwsh.exe')
    const builtin = defaultShell({
      platform: 'win32',
      env: { SystemRoot: 'C:\\Win' },
      which: () => null,
    })
    expect(builtin.file).toBe('C:\\Win\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  })
})

describe('terminalEnv', () => {
  it('remove variáveis internas e define TERM', () => {
    const env = terminalEnv(
      {
        PATH: '/bin',
        ELECTRON_RENDERER_URL: 'http://localhost:5173',
        AIC_USER_DATA_DIR: '/x',
        EMPTY: undefined,
      },
      { FOO: 'bar' },
    )
    expect(env).toMatchObject({ PATH: '/bin', TERM: 'xterm-256color', FOO: 'bar' })
    expect(env).not.toHaveProperty('ELECTRON_RENDERER_URL')
    expect(env).not.toHaveProperty('AIC_USER_DATA_DIR')
    expect(env).not.toHaveProperty('EMPTY')
  })
})
