import { describe, expect, it } from 'vitest'
import { gitAuthEnv, parseGitHubRemote } from './github-remote'

describe('parseGitHubRemote', () => {
  it.each([
    ['https://github.com/acme/app.git', 'https'],
    ['https://github.com/acme/app', 'https'],
    ['https://user@github.com/acme/app.git', 'https'],
    ['git@github.com:acme/app.git', 'ssh'],
    ['git@github.com:acme/app', 'ssh'],
    ['ssh://git@github.com/acme/app.git', 'ssh'],
    ['ssh://git@github.com:22/acme/app.git', 'ssh'],
  ])('%s', (url, protocol) => {
    expect(parseGitHubRemote(url)).toEqual({ owner: 'acme', repo: 'app', protocol })
  })

  it('recusa outros hosts e formatos', () => {
    expect(parseGitHubRemote('https://gitlab.com/acme/app.git')).toBeNull()
    expect(parseGitHubRemote('/srv/git/app.git')).toBeNull()
    expect(parseGitHubRemote('https://github.com/acme')).toBeNull()
  })

  it('aceita host customizado (Enterprise)', () => {
    expect(parseGitHubRemote('https://ghe.empresa.com/time/repo.git', 'ghe.empresa.com')).toEqual({
      owner: 'time',
      repo: 'repo',
      protocol: 'https',
    })
  })

  it('aceita nomes com pontos', () => {
    expect(parseGitHubRemote('git@github.com:acme/site.github.io.git')?.repo).toBe('site.github.io')
  })
})

describe('gitAuthEnv', () => {
  it('monta o extraheader por variável de ambiente', () => {
    const env = gitAuthEnv('gho_x')
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader')
    expect(env.GIT_CONFIG_VALUE_0).toBe(
      `AUTHORIZATION: basic ${Buffer.from('x-access-token:gho_x').toString('base64')}`,
    )
  })
})
