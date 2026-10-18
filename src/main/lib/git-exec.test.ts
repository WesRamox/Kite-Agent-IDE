import { describe, expect, it, vi } from 'vitest'
import { AppException } from './errors'
import { cleanGitMessage, execGit, showOrEmpty } from './git-exec'

describe('cleanGitMessage', () => {
  it('tira prefixos do git e limita a 3 linhas', () => {
    const err = new Error('fatal: a\nerror: b\n\nhint: c\nd')
    expect(cleanGitMessage(err)).toBe('a b c')
  })
})

describe('execGit', () => {
  it('converte falha do runner em GIT_ERROR com a mensagem limpa', async () => {
    const run = vi.fn().mockRejectedValue(new Error('fatal: not a git repository'))
    await expect(execGit(run, '/r', ['status'])).rejects.toMatchObject({
      code: 'GIT_ERROR',
      message: 'not a git repository',
    })
  })

  it('repassa AppException sem trocar o código', async () => {
    const run = vi.fn().mockRejectedValue(new AppException('NOT_FOUND', 'x'))
    await expect(execGit(run, '/r', [])).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('showOrEmpty', () => {
  it('devolve vazio quando o objeto não existe', async () => {
    const run = vi.fn().mockRejectedValue(new Error('fatal: path not in HEAD'))
    await expect(showOrEmpty(run, '/r', 'HEAD:x')).resolves.toBe('')
  })

  it('recusa objeto maior que o limite do editor', async () => {
    const run = vi.fn().mockResolvedValue(String(50 * 1024 * 1024))
    await expect(showOrEmpty(run, '/r', 'HEAD:big')).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    })
  })
})
