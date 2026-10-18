import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

// Barra de ações no topo (workspace e tarefa), tarefas escondidas e botões da janela.
test('barra de ações: agente na raiz, terminal por repo, revisar, entregar; mostrar escondida', async () => {
  test.skip(process.platform === 'win32', 'claude falso é um script POSIX')
  test.setTimeout(90_000)
  const base = await makeWorkspace({
    'speed/api/server.ts': 'export const a = 1\n',
    'speed/web/page.tsx': 'export const b = 1\n',
  })
  const root = path.join(base, 'speed')
  for (const r of ['api', 'web']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'dev')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
    git(
      dir,
      'worktree',
      'add',
      '-q',
      '-b',
      'TECH-1-x',
      path.join(root, '.worktrees/TECH-1', r),
      'dev',
    )
  }
  await writeFile(path.join(root, '.worktrees/TECH-1/api/server.ts'), 'mudou\n')
  // `claude` falso: grava onde foi aberto.
  const bin = await mkdtemp(path.join(tmpdir(), 'kite-bin-'))
  await writeFile(path.join(bin, 'claude'), '#!/bin/sh\npwd > "$HOME_MARK"\nsleep 30\n', {
    mode: 0o755,
  })
  const mark = path.join(bin, 'onde.txt')
  const ctx = await launch(root, {
    env: { PATH: `${bin}:${process.env['PATH'] ?? ''}`, HOME_MARK: mark },
  })
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    await page.getByRole('button', { name: 'Importar 1 tarefa' }).click()

    // Botões da janela na barra de menus.
    const bar = page.getByRole('menubar', { name: 'Menu do Kite' })
    await expect(bar.getByRole('button', { name: 'Minimizar' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Fechar' })).toBeVisible()

    // Workspace: o agente abre num terminal na raiz.
    await page.getByRole('button', { name: 'Claude Code aqui' }).click()
    await expect.poll(() => readFile(mark, 'utf8').catch(() => '')).toBe(`${root}\n`)

    // Escolher a tarefa pela barra.
    await page.getByRole('button', { name: /^Escolher tarefa.+K$/ }).click()
    await page
      .getByRole('dialog', { name: 'Trocar de tarefa' })
      .getByRole('button', { name: /TECH-1/ })
      .first()
      .click()
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText('TECH-1')

    // Terminal num repo da tarefa.
    await page.getByRole('button', { name: 'Abrir terminal em…' }).click()
    await page.getByRole('menuitem', { name: 'web' }).click()
    await expect(page.locator('.dv-tab', { hasText: 'web' })).toBeVisible()

    // Revisar e Entregar.
    await page.getByRole('button', { name: 'Revisar', exact: true }).click()
    await expect(page.locator('.dv-tab', { hasText: 'Revisar · TECH-1' })).toBeVisible()
    await page.getByRole('button', { name: 'Entregar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Commit e abrir PRs' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Esconder da Central e mostrar de novo.
    await page
      .getByRole('navigation', { name: 'Atividades' })
      .getByRole('button', { name: /^Central de atenção/ })
      .click()
    await page.getByRole('button', { name: 'Tarefa TECH-1' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Esconder da Central' }).click()
    await expect(page.getByRole('button', { name: 'Tarefa TECH-1' })).toHaveCount(0)
    await page.getByRole('button', { name: /Escondidas · 1/ }).click()
    await page.getByRole('button', { name: 'Mostrar TECH-1 de novo' }).click()
    await expect(page.getByRole('button', { name: 'Tarefa TECH-1' })).toBeVisible()
  } finally {
    await ctx.cleanup()
  }
})
