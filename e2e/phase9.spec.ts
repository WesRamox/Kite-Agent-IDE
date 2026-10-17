import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'
import { startMockGitHub, type MockGitHub } from './github-mock'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

// Workspace com api e web, cada um com um "github.com/acme/<repo>" que é um bare local.
async function makeLoja(): Promise<{ base: string; root: string }> {
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
  })
  const root = path.join(base, 'loja')
  for (const r of ['api', 'web']) {
    const dir = path.join(root, r)
    const bare = path.join(base, `${r}.git`)
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
    git(dir, 'remote', 'add', 'origin', `https://github.com/acme/${r}.git`)
    git(dir, 'config', `url.${bare}.insteadOf`, `https://github.com/acme/${r}.git`)
    git(dir, 'push', '-q', 'origin', 'main')
    git(dir, 'worktree', 'add', '-q', '-b', 'PAY-412', path.join(root, `.worktrees/PAY-412/${r}`))
  }
  await writeFile(path.join(root, '.worktrees/PAY-412/TASK.md'), '# Checkout com Pix\n')
  return { base, root }
}

async function login(page: Page) {
  await page
    .getByRole('navigation', { name: 'Atividades' })
    .getByRole('button', { name: 'GitHub', exact: true })
    .click()
  await page.getByRole('button', { name: 'Entrar com GitHub' }).click()
  await expect(page.getByRole('button', { name: 'Sair do GitHub' })).toBeVisible({
    timeout: 10_000,
  })
}

test('revisar uma tarefa com 2 repos, commitar em lote e abrir os 2 PRs com links cruzados', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  test.setTimeout(120_000)
  const gh: MockGitHub = await startMockGitHub()
  const { base, root } = await makeLoja()
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(root, {
    userData,
    env: { GITHUB_CLIENT_ID: 'e2e-client', GITHUB_OAUTH_URL: gh.url, GITHUB_API_URL: gh.apiUrl },
  })
  const api = path.join(root, '.worktrees/PAY-412/api')
  const web = path.join(root, '.worktrees/PAY-412/web')
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()
    await login(page)

    // Mudanças nos dois repos (como um agente faria).
    await writeFile(path.join(api, 'server.ts'), 'export const api = 2\nexport const pix = true\n')
    await writeFile(path.join(web, 'pix.tsx'), 'export const Pix = () => null\n')

    // Revisar pela Central (botão direito na tarefa).
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page
      .getByRole('complementary')
      .first()
      .getByRole('button', { name: 'Tarefa Checkout com Pix' })
      .click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Revisar mudanças' }).click()
    await expect(page.getByRole('heading', { name: 'Revisar · Checkout com Pix' })).toBeVisible()
    const files = page.getByRole('complementary', { name: 'Arquivos alterados' })
    const apiGroup = files.getByRole('group', { name: 'Repositório api' })
    const webGroup = files.getByRole('group', { name: 'Repositório web' })
    await expect(apiGroup).toContainText('server.ts')
    await expect(apiGroup).toContainText('+2 −1')
    await expect(webGroup).toContainText('pix.tsx')
    await expect(webGroup).toContainText('+1')
    await expect(page.getByText('2 repos · 2 arquivos · +3 −1')).toBeVisible()
    await expect(page.locator('.monaco-diff-editor:visible')).toContainText('pix = true')
    await expect(page.getByText('main → PAY-412')).toBeVisible()
    await expect(apiGroup.getByRole('button', { name: 'Abrir PR' })).toBeVisible()

    // Commit e PR nos 2 repos.
    await page.getByRole('button', { name: 'Commit e PR nos 2 repos' }).click()
    const dialog = page.getByRole('dialog', { name: 'Commit e PRs da tarefa' })
    await dialog.getByLabel('Mensagem do commit').fill('feat: checkout com pix')
    await expect(dialog.getByLabel('Título do PR')).toHaveValue('PAY-412 Checkout com Pix')
    await dialog.getByRole('button', { name: 'Commit e abrir PRs' }).click()
    const result = dialog.getByRole('list', { name: 'Resultado' })
    await expect(result).toContainText('PR #42 aberto', { timeout: 20_000 })
    await expect(result).toContainText('PR #43 aberto')
    await expect(result).not.toContainText('falh')

    // Commits nas duas worktrees, branches enviadas, PRs com a base certa e links cruzados.
    for (const dir of [api, web]) {
      expect(git(dir, 'log', '-1', '--format=%s').trim()).toBe('feat: checkout com pix')
      expect(git(dir, 'status', '--porcelain').trim()).toBe('')
    }
    for (const r of ['api', 'web']) {
      expect(
        execFileSync(
          'git',
          ['--git-dir', path.join(base, `${r}.git`), 'branch', '--list', 'PAY-412'],
          { encoding: 'utf8' },
        ),
      ).toContain('PAY-412')
    }
    expect(gh.created.map((c) => [c['repo'], c['head'], c['base']])).toEqual([
      ['api', 'PAY-412', 'main'],
      ['web', 'PAY-412', 'main'],
    ])
    const bodyOf = (repo: string) => gh.updated.find((u) => u.repo === repo)?.body ?? ''
    expect(bodyOf('api')).toContain('https://github.com/acme/web/pull/43')
    expect(bodyOf('web')).toContain('https://github.com/acme/api/pull/42')
    expect(bodyOf('api')).toContain('Tarefa: PAY-412 · Checkout com Pix')

    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(apiGroup.getByRole('link', { name: 'PR #42' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Detalhes da tarefa' })).toContainText(
      'PR #42 aberto',
    )

    // Pedir ajuste ao agente: vai para o terminal da sessão ligada à tarefa.
    await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
    await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
    const settings = JSON.parse(await readFile(path.join(userData, 'claude-settings.json'), 'utf8'))
    const command = settings.hooks.Stop[0].hooks[0].command as string
    await writeFile(
      path.join(root, '.worktrees/PAY-412/ev.json'),
      JSON.stringify({
        session_id: 'sess-pay',
        cwd: path.join(root, '.worktrees/PAY-412'),
        hook_event_name: 'Stop',
        last_assistant_message: 'Pronto.',
      }),
    )
    await page.keyboard.press(`${mod}+Backquote`)
    await expect(page.locator('.dv-tab.dv-active-tab', { hasText: 'Terminal' })).toBeVisible()
    await page.locator('.xterm:visible').click()
    await page.keyboard.type(`sh -c "${command}" < ev.json; cat > pedido.txt`)
    await page.keyboard.press('Enter')
    await expect(page.locator('footer')).toContainText('● 1 esperando você')
    await page.locator('.dv-tab', { hasText: 'Revisar · Checkout com Pix' }).click()
    await page.getByRole('button', { name: 'Pedir ajuste ao agente' }).click()
    await page
      .getByRole('dialog', { name: 'Pedir ajuste ao agente' })
      .getByLabel('Pedido')
      .fill('renomeie pix para pixCharge')
    await page
      .getByRole('dialog', { name: 'Pedir ajuste ao agente' })
      .getByRole('button', { name: 'Enviar' })
      .click()
    await expect
      .poll(() =>
        readFile(path.join(root, '.worktrees/PAY-412/pedido.txt'), 'utf8').catch(() => ''),
      )
      .toContain('renomeie pix para pixCharge')
  } finally {
    await ctx.cleanup()
    await gh.close()
    await rm(base, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
