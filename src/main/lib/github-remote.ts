export interface RemoteRef {
  owner: string
  repo: string
  protocol: 'https' | 'ssh'
}

// Reconhece remotes do GitHub (ou do host configurado):
//   https://github.com/owner/repo(.git)   git@github.com:owner/repo(.git)
//   ssh://git@github.com(:22)/owner/repo(.git)
export function parseGitHubRemote(url: string, host = 'github.com'): RemoteRef | null {
  const h = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const name = '([A-Za-z0-9_.-]+)'
  const tail = `${name}/${name}?(?:\\.git)?/?$`
  const patterns: [RegExp, RemoteRef['protocol']][] = [
    [new RegExp(`^https?://(?:[^@/]+@)?${h}(?::\\d+)?/${tail}`, 'i'), 'https'],
    [new RegExp(`^(?:[^@/]+@)?${h}:${tail}`, 'i'), 'ssh'],
    [new RegExp(`^ssh://(?:[^@/]+@)?${h}(?::\\d+)?/${tail}`, 'i'), 'ssh'],
  ]
  for (const [re, protocol] of patterns) {
    const m = re.exec(url.trim())
    if (m?.[1] && m[2]) {
      const repo = m[2].replace(/\.git$/i, '')
      if (repo) return { owner: m[1], repo, protocol }
    }
  }
  return null
}

// Header de autenticação para fetch/push https, passado ao git por variáveis de ambiente
// (nunca na linha de comando, que aparece no `ps`).
export function gitAuthEnv(token: string, host = 'github.com'): Record<string, string> {
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.https://${host}/.extraheader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  }
}
