import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

// Workspace "loja" com 3 repos e tarefas criadas por fora, em layouts diferentes.
async function makeLoja(): Promise<{ base: string; root: string }> {
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
    'loja/infra/main.tf': 'resource {}\n',
  })
  const root = path.join(base, 'loja')
  for (const r of ['api', 'web', 'infra']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
  }
  const wt = (repo: string, ...args: string[]) =>
    git(path.join(root, repo), 'worktree', 'add', '-q', ...args)
  // Pasta da tarefa dentro do workspace, com título num TASK.md.
  wt('api', '-b', 'PAY-412', path.join(root, '.worktrees/PAY-412/api'))
  wt('web', '-b', 'PAY-412', path.join(root, '.worktrees/PAY-412/web'))
  await writeFile(path.join(root, '.worktrees/PAY-412/TASK.md'), '# Checkout com Pix\n')
  // Pastas de worktrees por repo, fora do workspace, mesma branch.
  wt('api', '-b', 'feat/OPS-19', path.join(base, 'api-worktrees/OPS-19'))
  wt('infra', '-b', 'feat/OPS-19', path.join(base, 'infra-worktrees/OPS-19'))
  // Uma tarefa de um repo só e uma worktree solta (sem branch).
  wt('web', '-b', 'SEO-4', path.join(root, '.worktrees/SEO-4/web'))
  wt('web', '--detach', path.join(root, 'web-hotfix'))
  return { base, root }
}

const sidebar = (page: Page) => page.getByRole('complementary').first()

test('tarefas multi-repo: descobrir, abrir, editar dois repos, trocar e ligar sessões', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  test.setTimeout(120_000)
  const { base, root } = await makeLoja()
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  const ctx = await launch(root, { userData })
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()

    // Descoberta (primeira vez no workspace).
    await expect(page.getByText('Encontramos 3 repositórios e 6 worktrees.')).toBeVisible()
    const found = page.getByRole('region', { name: 'Tarefas encontradas' })
    await expect(found.getByRole('textbox', { name: 'Nome da tarefa' })).toHaveCount(3)
    await expect(found.getByRole('textbox', { name: 'Nome da tarefa' }).nth(1)).toHaveValue(
      'Checkout com Pix',
    )
    await expect(found).toContainText('mesma pasta .worktrees/PAY-412')
    await expect(found).toContainText('mesma branch em 2 repos')
    await expect(found).toContainText('web-hotfix')
    await found.getByRole('checkbox', { name: 'Importar SEO-4' }).uncheck()
    await page.getByRole('button', { name: 'Importar 2 tarefas' }).click()
    await expect(page.getByText('Encontramos 3 repositórios')).toBeHidden()

    // Na Central, as tarefas sem agente; SEO-4 ficou de fora.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    const idle = sidebar(page).getByRole('group', { name: 'Sem agente' })
    await expect(idle).toContainText('Checkout com Pix')
    await expect(idle).toContainText('OPS-19')
    await expect(idle).not.toContainText('SEO-4')
    await expect(sidebar(page)).toContainText('3 repos')

    // "Descobrir" na Central reabre a tela de descoberta.
    await sidebar(page).getByRole('button', { name: 'Descobrir', exact: true }).click()
    await expect(page.getByText('Encontramos 3 repositórios e 6 worktrees.')).toBeVisible()
    await page.getByRole('button', { name: 'Fechar Descobrir tarefas' }).click()
    await expect(page.getByText('Encontramos 3 repositórios')).toBeHidden()

    // Abrir a tarefa: explorer com uma raiz por worktree e detalhes à direita.
    await idle.getByRole('button', { name: 'Tarefa Checkout com Pix' }).click()
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText(
      'Checkout com Pix',
    )
    const details = page.getByRole('complementary', { name: 'Detalhes da tarefa' })
    await expect(details).toContainText('api')
    await expect(details).toContainText('web')
    const apiRoot = path.join(root, '.worktrees/PAY-412/api')
    const webRoot = path.join(root, '.worktrees/PAY-412/web')
    // Abre em "Alterados": por repo, só o que mudou contra a base (nada, por enquanto).
    const changed = page.getByRole('tree', { name: 'Arquivos alterados' })
    await expect(changed.getByRole('group', { name: 'api' })).toContainText('PAY-412')
    await expect(changed.getByRole('group', { name: 'api' })).toContainText(
      'Nada alterado contra main',
    )
    const shown = page.getByRole('radiogroup', { name: 'Arquivos mostrados' })
    await shown.getByRole('radio', { name: 'Todos' }).click()
    await expect(page.locator(`[data-node-id="${apiRoot}"]`)).toContainText('PAY-412')

    // Editar arquivos dos dois repos na mesma janela.
    for (const [dir, file, text] of [
      [apiRoot, 'server.ts', '// pix na api'],
      [webRoot, 'page.tsx', '// pix no web'],
    ] as const) {
      await page.locator(`[data-node-id="${dir}"]`).click()
      await page.locator(`[data-node-id="${path.join(dir, file)}"]`).click()
      await expect(page.locator('.dv-tab.dv-active-tab', { hasText: file })).toBeVisible()
      await page.locator('.monaco-editor:visible .view-lines').click()
      await page.keyboard.press(`${mod}+End`)
      await page.keyboard.type(`\n${text}`)
      await page.keyboard.press(`${mod}+s`)
      await expect.poll(() => readFile(path.join(dir, file), 'utf8')).toContain(text)
    }
    await expect(page.locator('.dv-tab', { hasText: 'server.ts' })).toContainText('api')
    await expect(details).toContainText('1 alterado')

    // Em "Alterados", só os dois arquivos editados, cada um no seu repo; clicar abre o arquivo.
    await shown.getByRole('radio', { name: 'Alterados' }).click()
    await expect(changed.getByRole('group', { name: 'api' })).toContainText('server.ts')
    await expect(changed.getByRole('group', { name: 'web' })).toContainText('page.tsx')
    await expect(changed.getByRole('button', { name: /\.ts|\.tsx/ })).toHaveCount(2)
    await changed
      .getByRole('group', { name: 'web' })
      .getByRole('button', { name: 'page.tsx' })
      .click()
    await expect(page.locator('.dv-tab.dv-active-tab', { hasText: 'page.tsx' })).toBeVisible()
    await shown.getByRole('radio', { name: 'Todos' }).click()

    // Ctrl+K: troca para OPS-19 (worktrees fora do workspace) e volta, com as abas no lugar.
    await page.keyboard.press(`${mod}+k`)
    await page
      .getByRole('dialog', { name: 'Trocar de tarefa' })
      .getByText('OPS-19 · OPS-19')
      .click()
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText('OPS-19')
    await expect(
      page.locator(`[data-node-id="${path.join(base, 'infra-worktrees/OPS-19')}"]`),
    ).toBeVisible()
    await expect(page.locator('.dv-tab:visible', { hasText: 'server.ts' })).toHaveCount(0)
    await page.keyboard.press(`${mod}+k`)
    await page
      .getByRole('dialog', { name: 'Trocar de tarefa' })
      .getByText('PAY-412 · Checkout com Pix')
      .click()
    await expect(page.locator('.dv-tab:visible', { hasText: 'server.ts' })).toBeVisible()
    await expect(page.locator('.dv-tab:visible', { hasText: 'page.tsx' })).toBeVisible()

    // Worktree nova criada por fora entra na tarefa sozinha.
    git(
      path.join(root, 'infra'),
      'worktree',
      'add',
      '-q',
      '-b',
      'PAY-412',
      path.join(root, '.worktrees/PAY-412/infra'),
    )
    await expect(
      page.locator(`[data-node-id="${path.join(root, '.worktrees/PAY-412/infra')}"]`),
    ).toBeVisible({ timeout: 3000 })

    // Sessão aberta na raiz do workspace é ligada à tarefa pelos arquivos que edita.
    await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
    await page.getByRole('button', { name: 'Conectar', exact: true }).first().click()
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
    const settings = JSON.parse(await readFile(path.join(userData, 'claude-settings.json'), 'utf8'))
    const command = settings.hooks.Stop[0].hooks[0].command as string
    const fire = (payload: Record<string, unknown>) =>
      execFileSync('/bin/sh', ['-c', command], {
        input: JSON.stringify({ session_id: 'sess-raiz', cwd: root, ...payload }),
      })
    fire({ hook_event_name: 'UserPromptSubmit', prompt: 'cria o alerta de fila' })
    fire({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(base, 'infra-worktrees/OPS-19/main.tf') },
    })
    await expect(
      page
        .getByRole('region', { name: 'Sessões detectadas' })
        .getByText('Vinculada a OPS-19 automaticamente'),
    ).toBeVisible()
    await page.locator('footer').getByRole('button', { name: '● 1 trabalhando' }).click()
    await expect(page.getByRole('region', { name: 'Trabalhando' })).toContainText('OPS-19')
    await expect(sidebar(page).getByRole('group', { name: 'Trabalhando' })).toContainText(
      'api · infra — trabalhando',
    )
  } finally {
    await ctx.cleanup()
    await rm(base, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
