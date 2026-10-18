import { describe, expect, it } from 'vitest'
import { branchSlug } from './branch-slug'

describe('branchSlug', () => {
  it('tira acentos e espaços, mantém o código do card', () => {
    expect(branchSlug('PAY-415 Estorno parcial')).toBe('PAY-415-Estorno-parcial')
    expect(branchSlug('  Ação: login/social  ')).toBe('Acao-login-social')
    expect(branchSlug('.oculto.')).toBe('oculto')
    expect(branchSlug('x'.repeat(80))).toHaveLength(60)
  })
})
