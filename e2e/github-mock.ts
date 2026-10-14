import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// Servidor GitHub falso: Device Flow + as rotas da API REST que o app usa.

export const TOKEN = 'gho_e2e_token'

export interface MockGitHub {
  url: string
  apiUrl: string
  created: Record<string, unknown>[]
  close: () => Promise<void>
}

const pull = (n: number, title: string, head: string, extra: object = {}) => ({
  number: n,
  title,
  user: { login: 'dev' },
  state: 'open',
  draft: false,
  merged_at: null,
  head: { ref: head, sha: `sha${n}`, repo: { full_name: 'acme/app' } },
  base: { ref: 'main' },
  updated_at: new Date(Date.now() - 3_600_000).toISOString(),
  html_url: `https://github.com/acme/app/pull/${n}`,
  body: `Corpo do PR ${n}`,
  additions: 10,
  deletions: 2,
  changed_files: 1,
  mergeable: true,
  ...extra,
})

const PULLS = [
  pull(7, 'Login com GitHub', 'feat/login'),
  pull(8, 'Refatora o cache', 'chore/cache', { draft: true }),
]

const ISSUES = [
  {
    number: 3,
    title: 'Erro ao salvar',
    user: { login: 'ana' },
    state: 'open',
    labels: [{ name: 'bug', color: 'd73a4a' }],
    comments: 4,
    updated_at: new Date().toISOString(),
    html_url: 'https://github.com/acme/app/issues/3',
    body: 'Passos para reproduzir…',
  },
  {
    ...pull(7, 'Login com GitHub', 'feat/login'),
    labels: [],
    comments: 0,
    pull_request: { url: 'x' },
  },
]

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const text = Buffer.concat(chunks).toString()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return Object.fromEntries(new URLSearchParams(text))
  }
}

export async function startMockGitHub(): Promise<MockGitHub> {
  const created: Record<string, unknown>[] = []
  let polls = 0
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    const body = req.method === 'POST' ? await readBody(req) : {}

    if (url.pathname === '/login/device/code') {
      return send(200, {
        device_code: 'device-secret',
        user_code: 'WDJB-MJHT',
        verification_uri: `http://${req.headers.host}/login/device`,
        expires_in: 900,
        interval: 1,
      })
    }
    if (url.pathname === '/login/oauth/access_token') {
      if (body['device_code'] !== 'device-secret')
        return send(200, { error: 'incorrect_device_code' })
      polls += 1
      return send(
        200,
        polls < 2
          ? { error: 'authorization_pending' }
          : { access_token: TOKEN, token_type: 'bearer', scope: 'repo' },
      )
    }

    if (!url.pathname.startsWith('/api/')) return send(404, { message: 'Not Found' })
    if (!String(req.headers.authorization ?? '').includes(TOKEN))
      return send(401, { message: 'Bad credentials' })
    const route = url.pathname.slice(4)
    const state = url.searchParams.get('state') ?? 'open'
    const byState = <T extends { state: string }>(items: T[]) =>
      state === 'all' ? items : items.filter((i) => i.state === state)

    if (route === '/user') return send(200, { login: 'octocat', name: 'Octo Cat', avatar_url: '' })
    if (route === '/repos/acme/app') {
      return send(200, {
        default_branch: 'main',
        html_url: 'https://github.com/acme/app',
        private: false,
      })
    }
    if (route === '/repos/acme/app/pulls' && req.method === 'GET') return send(200, byState(PULLS))
    if (route === '/repos/acme/app/pulls' && req.method === 'POST') {
      created.push(body)
      return send(201, {
        ...pull(42, String(body['title']), String(body['head'])),
        html_url: 'https://github.com/acme/app/pull/42',
      })
    }
    const pr = /^\/repos\/acme\/app\/pulls\/(\d+)$/.exec(route)
    if (pr) {
      const n = Number(pr[1])
      if (n === 42)
        return send(
          200,
          pull(42, String(created.at(-1)?.['title'] ?? ''), String(created.at(-1)?.['head'] ?? '')),
        )
      const found = PULLS.find((p) => p.number === n)
      return found ? send(200, found) : send(404, { message: 'Not Found' })
    }
    if (/^\/repos\/acme\/app\/commits\/[^/]+\/check-runs$/.test(route)) {
      return send(200, {
        total_count: 2,
        check_runs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/acme/app/runs/1',
          },
          { name: 'e2e', status: 'in_progress', conclusion: null, html_url: null },
        ],
      })
    }
    if (/^\/repos\/acme\/app\/commits\/[^/]+\/status$/.test(route))
      return send(200, { state: 'pending', statuses: [] })
    if (route === '/repos/acme/app/issues') return send(200, byState(ISSUES))
    const issue = /^\/repos\/acme\/app\/issues\/(\d+)$/.exec(route)
    if (issue) {
      const found = ISSUES.find((i) => i.number === Number(issue[1]))
      return found ? send(200, found) : send(404, { message: 'Not Found' })
    }
    return send(404, { message: `Rota não simulada: ${route}` })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const url = `http://127.0.0.1:${port}`
  return {
    url,
    apiUrl: `${url}/api`,
    created,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
