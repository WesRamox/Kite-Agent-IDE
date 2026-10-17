import { describe, expect, it } from 'vitest'
import { languageFor, translate } from '.'

describe('i18n', () => {
  it('traduz textos fixos e com parâmetros nos dois idiomas', () => {
    expect(translate('pt-BR', 'error.taskNotFound')).toBe('Tarefa não encontrada')
    expect(translate('en', 'error.taskNotFound')).toBe('Task not found')
    expect(translate('en', 'error.invalidBranch', { branch: 'x y' })).toBe(
      'Invalid branch name: x y',
    )
  })

  it('idioma padrão pelo locale do sistema', () => {
    expect(languageFor('pt-BR')).toBe('pt-BR')
    expect(languageFor('pt-PT')).toBe('pt-BR')
    expect(languageFor('en-US')).toBe('en')
    expect(languageFor('es')).toBe('en')
  })
})
