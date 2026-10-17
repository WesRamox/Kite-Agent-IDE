import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { git, launch, makeWorkspace, openedUrls, type Launched } from './app'
import { startMockGitHub, TOKEN, type MockGitHub } from './github-mock'

let gh: MockGitHub
let ctx: Launched
let bare: string

test.beforeEach(async () => {
  gh = await startMockGitHub()
  const ws = await makeWorkspace({ 'a.txt': 'principal\n' })
  bare = `${ws}-origin.git`
  git(path.dirname(ws), 'init', '-q', '--bare', '-b', 'main', bare)
  git(ws, 'init', '-q', '-b', 'main')
  git(ws, 'add', '.')
  git(ws, 'commit', '-q', '-m', 'inicial')
  git(ws, 'remote', 'add', 'origin', 'https://github.com/acme/app.git')
  // O "github.com" deste repositório é um bare local.
  git(ws, 'config', `url.${bare}.insteadOf`, 'https://github.com/acme/app.git')
  git(ws, 'push', '-q', 'origin', 'main')
  // PR #7 publicado em refs/pull/7/head, como o GitHub faz.
  git(ws, 'switch', '-q', '-c', 'tmp')
  await writeFile(path.join(ws, 'a.txt'), 'versão do PR 7\n')
  git(ws, 'commit', '-q', '-am', 'trabalho do PR 7')
  git(ws, 'push', '-q', 'origin', 'HEAD:refs/pull/7/head')
  git(ws, 'switch', '-q', 'main')
  git(ws, 'branch', '-q', '-D', 'tmp')

  ctx = await launch(ws, {
    env: { GITHUB_CLIENT_ID: 'e2e-client', GITHUB_OAUTH_URL: gh.url, GITHUB_API_URL: gh.apiUrl },
  })
})

test.afterEach(async () => {
  await ctx.cleanup()
  await gh.close()
  await rm(bare, { recursive: true, force: true })
  await rm(`${ctx.workspace}-worktrees`, { recursive: true, force: true })
})

const statusBar = (page: Page) => page.locator('footer')

async function openAndLogin(page: Page) {
  await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
  await expect(statusBar(page)).toContainText('worktree principal')
  await page.getByRole('button', { name: 'GitHub' }).click()
  await page.getByRole('button', { name: 'Entrar com GitHub' }).click()
  await expect(page.getByLabel('Código de verificação')).toHaveText('WDJB-MJHT')
  await expect.poll(() => openedUrls(ctx.app)).toContain(`${gh.url}/login/device`)
  await expect(page.getByRole('button', { name: 'Sair do GitHub' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Conectado ao GitHub como octocat.')).toBeVisible()
  await expect(page.getByText('acme/app')).toBeVisible()
}

test('login por Device Flow, lista PRs e issues, detalhes com checks', async () => {
  const page = ctx.page
  const output: string[] = []
  ctx.app.process().stdout?.on('data', (d: Buffer) => output.push(d.toString()))
  ctx.app.process().stderr?.on('data', (d: Buffer) => output.push(d.toString()))
  await openAndLogin(page)
  // O código foi para a área de transferência.
  await expect
    .poll(() => ctx.app.evaluate(({ clipboard }) => clipboard.readText()))
    .toBe('WDJB-MJHT')

  const prs = page.getByRole('list', { name: 'Pull requests' })
  await expect(prs).toContainText('Login com GitHub')
  await expect(prs).toContainText('#7 · dev · feat/login → main')
  await expect(prs).toContainText('Refatora o cache')

  await prs.getByText('Login com GitHub').click()
  await expect(page.locator('.dv-tab', { hasText: '#7 Login com GitHub' })).toBeVisible()
  const checks = page.getByRole('region', { name: 'Checks' })
  await expect(checks).toContainText('build')
  await expect(checks).toContainText('e2e')
  await expect(page.getByRole('region', { name: 'Descrição' })).toContainText('Corpo do PR 7')

  await page.getByRole('tab', { name: 'Issues' }).click()
  const issues = page.getByRole('list', { name: 'Issues' })
  await expect(issues).toContainText('Erro ao salvar')
  await expect(issues).toContainText('bug')
  await expect(issues).not.toContainText('Login com GitHub') // PRs não aparecem como issues

  await page.getByLabel('Filtrar por estado').selectOption('closed')
  await expect(page.getByText('Nenhuma issue.')).toBeVisible()

  // O token nunca aparece em log nem é gravado em texto puro (aqui sem cofre: só memória).
  expect(output.join('')).not.toContain(TOKEN)
  for (const name of await readdir(ctx.userData, { recursive: true })) {
    const file = path.join(ctx.userData, name)
    const content = await readFile(file).catch(() => Buffer.alloc(0))
    expect(content.includes(TOKEN), name).toBe(false)
  }
  await expect(readFile(path.join(ctx.userData, 'github-token.bin'))).rejects.toThrow()
})

test('abre um PR numa worktree', async () => {
  const page = ctx.page
  await openAndLogin(page)
  await page.getByRole('list', { name: 'Pull requests' }).getByText('Login com GitHub').click()
  await page.getByRole('button', { name: 'Abrir em worktree' }).click()

  const wt = path.join(`${ctx.workspace}-worktrees`, 'feat-login')
  await expect(statusBar(page)).toContainText('feat/login')
  await expect(statusBar(page)).toContainText('feat-login')
  await expect(readFile(path.join(wt, 'a.txt'), 'utf8')).resolves.toBe('versão do PR 7\n')
  await expect(readFile(path.join(ctx.workspace, 'a.txt'), 'utf8')).resolves.toBe('principal\n')
})

test('cria um PR a partir de uma branch local', async () => {
  const page = ctx.page
  git(ctx.workspace, 'switch', '-q', '-c', 'feat/novo-recurso')
  await writeFile(path.join(ctx.workspace, 'b.txt'), 'novo\n')
  git(ctx.workspace, 'add', '.')
  git(ctx.workspace, 'commit', '-q', '-m', 'adiciona b.txt')
  await openAndLogin(page)

  await page.getByRole('button', { name: 'Criar PR da branch atual' }).click()
  await expect(page.getByText('De feat/novo-recurso para acme/app:main')).toBeVisible()
  await page.getByLabel('Título').fill('Adiciona novo recurso')
  await page.getByLabel('Descrição').fill('Resolve #3')
  await page.getByRole('button', { name: 'Criar pull request' }).click()

  await expect(page.getByText('PR #42 criado.')).toBeVisible()
  await expect(page.locator('.dv-tab', { hasText: '#42 Adiciona novo recurso' })).toBeVisible()
  expect(gh.created).toEqual([
    {
      title: 'Adiciona novo recurso',
      body: 'Resolve #3',
      head: 'feat/novo-recurso',
      base: 'main',
      draft: false,
      repo: 'app',
    },
  ])
  // A branch foi enviada ao origin e passou a ter upstream.
  expect(git(bare, 'log', '-1', '--format=%s', 'feat/novo-recurso').trim()).toBe('adiciona b.txt')
  expect(git(ctx.workspace, 'rev-parse', '--abbrev-ref', '@{upstream}').trim()).toBe(
    'origin/feat/novo-recurso',
  )
})

test('sem GITHUB_CLIENT_ID explica como configurar', async () => {
  const other = await launch(ctx.workspace, { keepWorkspace: true, env: { GITHUB_CLIENT_ID: '' } })
  try {
    await other.page.getByRole('button', { name: 'GitHub' }).click()
    await expect(other.page.getByText('O login com GitHub não está configurado.')).toBeVisible()
  } finally {
    await other.cleanup()
  }
})
