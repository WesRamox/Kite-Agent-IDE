import { describe, expect, it, vi } from 'vitest'
import { AppException } from './errors'
import { assertBranchName, isSafeRefArg, isSimpleRefName } from './git-refs'

describe('isSafeRefArg', () => {
  it('aceita nomes comuns', () => {
    for (const n of ['main', 'feat/PAY-412', 'release/1.0', 'ação'])
      expect(isSafeRefArg(n)).toBe(true)
  })

  it('recusa o que viraria opção ou é estranho', () => {
    for (const n of [
      '',
      '-f',
      '--upload-pack=x',
      ' main',
      'main ',
      'a\nb',
      'a\u0000b',
      'x'.repeat(201),
    ])
      expect(isSafeRefArg(n)).toBe(false)
  })
})

describe('isSimpleRefName', () => {
  it('aceita branch com barras, pontos e hífens', () => {
    expect(isSimpleRefName('origin/release-1.2')).toBe(true)
  })

  it('recusa opção, .., espaços e @{', () => {
    for (const n of ['-x', 'a..b', 'a b', 'main@{1}', '/main', '.hidden'])
      expect(isSimpleRefName(n)).toBe(false)
  })
})

describe('assertBranchName', () => {
  it('pergunta ao git quando passa na barreira', async () => {
    const run = vi.fn().mockResolvedValue('feat/x\n')
    await assertBranchName(run, '/repo', 'feat/x')
    expect(run).toHaveBeenCalledWith('/repo', ['check-ref-format', '--branch', 'feat/x'])
  })

  it('não chama o git com nome que viraria opção', async () => {
    const run = vi.fn()
    await expect(assertBranchName(run, '/repo', '--help')).rejects.toBeInstanceOf(AppException)
    expect(run).not.toHaveBeenCalled()
  })

  it('converte a recusa do git em INVALID_ARGS', async () => {
    const run = vi.fn().mockRejectedValue(new Error('fatal'))
    await expect(assertBranchName(run, '/repo', 'a..b')).rejects.toMatchObject({
      code: 'INVALID_ARGS',
    })
  })
})
