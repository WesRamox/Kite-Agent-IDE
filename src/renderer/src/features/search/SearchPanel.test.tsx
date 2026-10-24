// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SearchQuery, SearchResult } from '@shared/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installApiInDom, ok } from '../../test/fake-api'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useTasksStore } from '../tasks/tasks.store'
import { useSearchStore } from './search.store'

const openFile = vi.fn(async () => {})
vi.mock('../editor/editor.actions', () => ({ openFile }))
const { SearchPanel } = await import('./SearchPanel')

const result: SearchResult = {
  repos: [
    {
      repoName: 'api',
      worktree: '/ws/wt/api',
      files: [
        {
          path: '/ws/wt/api/src/pix.ts',
          rel: 'src/pix.ts',
          matches: [
            { line: 4, column: 14, length: 3, preview: 'export const pix = 1', ranges: [[13, 16]] },
          ],
        },
      ],
    },
  ],
  files: 1,
  matches: 1,
  truncated: false,
}

describe('SearchPanel', () => {
  let search: ReturnType<typeof vi.fn<(r: string, id: string, q: SearchQuery) => Promise<unknown>>>

  let uninstall: () => void = () => {}

  beforeEach(() => {
    search = vi.fn(async () => ok(result))
    uninstall = installApiInDom({ search: { task: search } })
    useWorkspaceStore.setState({ root: '/ws' })
    useTasksStore.getState().reset()
    useSearchStore.setState({ text: '', caseSensitive: false, regex: false, wholeWord: false })
    openFile.mockClear()
  })
  afterEach(() => {
    cleanup()
    uninstall()
  })

  it('sem tarefa aberta, pede para escolher uma e não busca', () => {
    render(<SearchPanel />)
    expect(screen.getByText(/Abra uma tarefa/)).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Buscar na tarefa' })).toBeNull()
    expect(search).not.toHaveBeenCalled()
  })

  it('busca na tarefa aberta, mostra o resumo e abre a ocorrência na linha', async () => {
    useTasksStore.getState().set({ activeTaskId: 'folder:pay' })
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar na tarefa' }), {
      target: { value: 'pix' },
    })
    await waitFor(() => expect(screen.getByText('1 resultado em 1 arquivo')).toBeTruthy())
    expect(search).toHaveBeenCalledWith(
      '/ws',
      'folder:pay',
      expect.objectContaining({ text: 'pix', caseSensitive: false }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir src/pix.ts na linha 4' }))
    expect(openFile).toHaveBeenCalledWith('/ws/wt/api/src/pix.ts', {
      line: 4,
      column: 14,
      length: 3,
    })
  })

  it('ligar "maiúsculas" busca de novo com a opção', async () => {
    useTasksStore.getState().set({ activeTaskId: 'folder:pay' })
    useSearchStore.setState({ text: 'pix' })
    render(<SearchPanel />)
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Diferenciar maiúsculas e minúsculas' }))
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        '/ws',
        'folder:pay',
        expect.objectContaining({ caseSensitive: true }),
      ),
    )
  })

  it('erro do main aparece no lugar dos resultados', async () => {
    search.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_ARGS', message: 'Não foi possível buscar em api: regex' },
    })
    useTasksStore.getState().set({ activeTaskId: 'folder:pay' })
    useSearchStore.setState({ text: '(', regex: true })
    render(<SearchPanel />)
    await waitFor(() => expect(screen.getByText(/Não foi possível buscar em api/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Abrir src\/pix.ts/ })).toBeNull()
  })
})
