import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

const FAKE_AGENT = path.join(__dirname, 'fixtures', 'fake-agent.cjs')

async function seedPresets(dir: string) {
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'agents.json'),
    JSON.stringify({
      presets: [
        {
          id: 'custom',
          name: 'Agente falso',
          command: `node ${FAKE_AGENT}`,
          promptMode: 'arg',
          promptFlag: '',
        },
      ],
      tasks: [],
    }),
  )
}

async function makeLoja(): Promise<{ base: string; root: string }> {
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
  })
  const root = path.join(base, 'loja')
  for (const r of ['api', 'web']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
  }
  return { base, root }
}

const integration = (page: Page, name: string) =>
  page.getByRole('region', { name: 'Integrações' }).getByRole('group', { name, exact: true })

test('Codex e Gemini avisam o Kite; nova tarefa com 2 repos abre o agente na pasta da tarefa', async () => {
  test.skip(process.platform === 'win32', 'comando do hook é POSIX; Windows verificar depois')
  test.setTimeout(120_000)
  const { base, root } = await makeLoja()
  const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
  await seedPresets(userData)
  const codexHooks = path.join(userData, 'codex-hooks.json')
  const geminiSettings = path.join(userData, 'gemini-settings.json')
  const ctx = await launch(root, {
    userData,
    env: { KITE_CODEX_HOOKS: codexHooks, KITE_GEMINI_SETTINGS: geminiSettings },
  })
  try {
    const { page, app } = ctx
    await app.evaluate(({ Notification }) => {
      Notification.prototype.show = () => {}
    })
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await expect(page.locator('[role="tree"]')).toBeVisible()

    // Conectar o Codex e o Gemini pela mesma tela.
    await page.getByRole('button', { name: 'Conectar Claude Code' }).click()
    for (const name of ['Codex CLI', 'Gemini CLI']) {
      await integration(page, name).getByRole('button', { name: 'Conectar' }).click()
      await expect(integration(page, name)).toContainText('Conectado')
    }
    const codex = JSON.parse(await readFile(codexHooks, 'utf8'))
    const codexCmd = codex.hooks.PermissionRequest[0].hooks[0].command as string
    expect(codexCmd).toMatch(/kite-hook\.sh' codex; exit 0$/)
    const gemini = JSON.parse(await readFile(geminiSettings, 'utf8'))
    const geminiCmd = gemini.hooks.AfterAgent[0].hooks[0].command as string
    expect(gemini.hooks.AfterAgent[0].hooks[0].timeout).toBe(10_000)
    const fire = (cmd: string, payload: Record<string, unknown>) =>
      execFileSync('/bin/sh', ['-c', cmd], {
        input: JSON.stringify({ cwd: root, ...payload }),
      }).toString()

    // Codex pedindo permissão aparece na Central com o comando.
    fire(codexCmd, {
      session_id: 'codex-1',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'roda os testes',
    })
    fire(codexCmd, {
      session_id: 'codex-1',
      hook_event_name: 'PermissionRequest',
      tool_name: 'shell',
      tool_input: { command: ['pnpm', 'test'] },
    })
    await page.locator('footer').getByRole('button', { name: '● 1 esperando você' }).click()
    const waiting = page.getByRole('region', { name: 'Esperando você' })
    await expect(waiting.getByRole('article')).toContainText('Codex CLI · rodando fora do Kite')
    await expect(waiting.getByRole('article')).toContainText('Quer executar · shell')
    await expect(waiting.getByRole('article')).toContainText('pnpm test')
    fire(codexCmd, {
      session_id: 'codex-1',
      hook_event_name: 'Stop',
      last_assistant_message: 'Testes ok.',
    })
    await expect(waiting.getByRole('article')).toContainText('Sua vez')
    await expect(waiting.getByRole('button', { name: 'Copiar comando codex resume' })).toBeVisible()

    // Gemini: responde JSON ao CLI e entra como sessão do Gemini.
    expect(
      fire(geminiCmd, { session_id: 'gem-1', hook_event_name: 'BeforeAgent', prompt: 'refatora' }),
    ).toBe('{}')
    fire(geminiCmd, {
      session_id: 'gem-1',
      hook_event_name: 'AfterAgent',
      prompt_response: 'Refatorei.',
    })
    await expect(page.locator('footer')).toContainText('● 2 esperando você')
    await expect(waiting).toContainText('Gemini CLI · rodando fora do Kite')
    await expect(waiting).toContainText('“Refatorei.”')

    // Nova tarefa com 2 repos pelo Kite.
    await page.getByRole('button', { name: '+ Nova' }).click()
    const form = page.getByRole('form', { name: 'Nova tarefa' })
    await form.getByLabel('Nome da tarefa').fill('PAY-415 Estorno parcial')
    await expect(form.getByLabel('Branch')).toHaveValue('PAY-415-Estorno-parcial')
    await form.getByLabel('Branch').fill('PAY-415')
    await form.getByRole('checkbox', { name: 'api' }).check()
    await form.getByRole('checkbox', { name: 'web' }).check()
    await form.getByLabel('Agente').selectOption('custom')
    await form.getByLabel('Prompt inicial').fill('comece pelo api')
    await form.getByRole('button', { name: 'Iniciar agente' }).click()

    const folder = path.join(root, '.worktrees/PAY-415')
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText(
      'PAY-415 Estorno parcial',
    )
    for (const r of ['api', 'web']) {
      expect((await stat(path.join(folder, r))).isDirectory()).toBe(true)
      expect(git(path.join(folder, r), 'branch', '--show-current').trim()).toBe('PAY-415')
    }
    expect(await readFile(path.join(folder, 'TASK.md'), 'utf8')).toBe('# PAY-415 Estorno parcial\n')
    // O agente roda na pasta da tarefa, com o prompt inicial.
    await expect
      .poll(() =>
        readFile(path.join(folder, 'saida-pay-415-estorno-parcial.txt'), 'utf8').catch(() => ''),
      )
      .toBe('comece pelo api\n')
    await expect(
      page.locator('.dv-tab.dv-active-tab', { hasText: 'PAY-415 Estorno parcial' }),
    ).toBeVisible()

    // Na Central, o agente aparece dentro da tarefa.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    const item = page
      .getByRole('complementary')
      .first()
      .getByRole('button', { name: 'Tarefa PAY-415 Estorno parcial' })
    await expect(item).toContainText('api · web — esperando você', { timeout: 15_000 })
    await expect(
      page
        .getByRole('complementary')
        .first()
        .getByRole('button', { name: /^Tarefa / }),
    ).toHaveCount(3)
  } finally {
    await ctx.cleanup()
    await rm(base, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
