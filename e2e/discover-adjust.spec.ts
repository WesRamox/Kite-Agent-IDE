import path from 'node:path'
import { expect, test } from '@playwright/test'
import { git, launch, makeWorkspace } from './app'

// Ajustes em "Descobrir tarefas": worktree já agrupada, tarefa montada à mão e repositórios.
test('descobrir tarefas: separar worktree, desfazer tarefa, tirar/restaurar repo e escolher pelo explorer', async () => {
  test.setTimeout(60_000)
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
    git(dir, 'worktree', 'add', '-q', '-b', 'PAY-1', path.join(root, '.worktrees/PAY-1', r))
  }
  const ctx = await launch(root)
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    const found = page.getByRole('region', { name: 'Tarefas encontradas' })
    const names = found.getByRole('textbox', { name: 'Nome da tarefa' })
    await expect(names).toHaveCount(1)

    // Separar a worktree do web numa tarefa nova, montada à mão.
    await found.getByRole('button', { name: 'Ações da worktree web' }).click()
    await page.getByRole('menuitem', { name: 'Separar em nova tarefa' }).click()
    await expect(names).toHaveCount(2)
    await expect(found).toContainText('montada por você')

    // Desfazer devolve a worktree à tarefa original.
    await found.getByRole('button', { name: /^Desfazer a tarefa / }).click()
    await expect(names).toHaveCount(1)
    await expect(found).not.toContainText('montada por você')

    // Tirar o repo web do workspace e restaurar.
    await page.getByRole('button', { name: 'Remover web' }).click()
    await expect(found).not.toContainText('.worktrees/PAY-1/web')
    await expect(page.getByText('fora do workspace')).toBeVisible()
    await page.getByRole('button', { name: 'Restaurar web' }).click()
    await expect(found).toContainText('.worktrees/PAY-1/web')

    // Depois de importar, o explorer do workspace tem o seletor de tarefa.
    await page.getByRole('button', { name: /^Importar/ }).click()
    await expect(page.getByText('Ctrl+K abre a tarefa do workspace')).toBeVisible()
    await page.getByRole('button', { name: 'Escolher tarefa', exact: true }).click()
    const switcher = page.getByRole('dialog', { name: 'Trocar de tarefa' })
    await expect(switcher).toContainText('PAY-1')
    await switcher.getByRole('button', { name: /PAY-1/ }).first().click()
    await expect(page.getByRole('button', { name: 'Trocar de tarefa' })).toContainText('PAY-1')
  } finally {
    await ctx.cleanup()
  }
})

// Worktrees em <repo>/.worktrees/<tarefa>: o padrão de pasta não acha nada, e a descoberta
// sugere juntar as da mesma branch.
test('descobrir tarefas: avisa o padrão que não acha nada e sugere o grupo das soltas', async () => {
  test.setTimeout(60_000)
  const base = await makeWorkspace({
    'loja/api/server.ts': 'export const api = 1\n',
    'loja/web/page.tsx': 'export const web = 1\n',
    'loja/db/schema.sql': 'select 1;\n',
  })
  const root = path.join(base, 'loja')
  for (const r of ['api', 'web', 'db']) {
    const dir = path.join(root, r)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'inicial')
  }
  for (const r of ['api', 'web']) {
    git(
      path.join(root, r),
      'worktree',
      'add',
      '-q',
      '-b',
      'feat/PAY-2',
      path.join(root, r, '.worktrees/PAY-2'),
    )
  }
  git(
    path.join(root, 'db'),
    'worktree',
    'add',
    '-q',
    '-b',
    'OPS-3',
    path.join(root, 'db', '.worktrees/OPS-3'),
  )
  const ctx = await launch(root)
  try {
    const { page } = ctx
    await page.getByRole('button', { name: 'Abrir pasta' }).first().click()
    const found = page.getByRole('region', { name: 'Tarefas encontradas' })

    // O rádio é controlado: só marca quando o main devolve o agrupamento novo.
    await page.getByRole('radio', { name: /Por padrão de pasta/ }).click()
    await expect(found).toContainText('não encontrou nenhuma worktree')
    await expect(found).toContainText('Sem tarefa · 3 worktrees')
    await expect(found).toContainText('Outras worktrees')

    // O grupo sugerido vira uma tarefa só, com as duas worktrees.
    await found.getByRole('button', { name: 'Criar tarefa com as 2' }).click()
    const names = found.getByRole('textbox', { name: 'Nome da tarefa' })
    await expect(names).toHaveCount(1)
    await expect(names).toHaveValue('feat/PAY-2')
    await expect(found).toContainText('Sem tarefa · 1 worktree')

    // A que sobrou sozinha sai pelo menu.
    await found.getByRole('button', { name: 'Ações da worktree db' }).click()
    await page.getByRole('menuitem', { name: 'Ignorar worktree' }).click()
    await expect(found).not.toContainText('Sem tarefa')

    // O aviso some com o automático.
    await page.getByRole('radio', { name: /Automático/ }).click()
    await expect(found).not.toContainText('não encontrou nenhuma worktree')
  } finally {
    await ctx.cleanup()
  }
})
