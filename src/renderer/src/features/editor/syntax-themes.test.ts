import { describe, expect, it } from 'vitest'
import { THEMES } from '@shared/themes'
import { bracketColors, SYNTAX, syntaxRules } from './syntax-themes'

describe('syntax-themes', () => {
  it('todo tema do app tem paleta de sintaxe com cores hex válidas', () => {
    for (const t of THEMES) {
      const s = SYNTAX[t.id]
      const { source, italic, brackets, ...colors } = s
      expect(source).not.toBe('')
      for (const role of italic) expect(colors[role]).toBeDefined()
      for (const c of [...Object.values(colors), ...brackets]) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('gera regras do Monaco sem # e com estilo nos comentários', () => {
    const rules = syntaxRules(SYNTAX.kite)
    expect(rules.find((r) => r.token === 'keyword')?.foreground).toBe('ff8f40')
    expect(rules.find((r) => r.token === 'comment')?.fontStyle).toBe('italic')
    expect(syntaxRules(SYNTAX.light).find((r) => r.token === 'comment')?.fontStyle).toBe('')
    for (const r of rules) if (r.foreground) expect(r.foreground).toMatch(/^[0-9a-f]{6}$/)
  })

  it('Preto vivo: itálico além dos comentários e cor própria para identificadores', () => {
    const rules = syntaxRules(SYNTAX.vivid)
    const style = (token: string) => rules.find((r) => r.token === token)?.fontStyle
    expect(style('keyword')).toBe('italic')
    expect(style('type')).toBe('italic')
    expect(style('string')).toBe('')
    expect(rules.find((r) => r.token === 'identifier')?.foreground).toBe('28a9ff')
    // Nos outros temas o identificador segue a cor do texto: nenhuma regra para ele.
    expect(syntaxRules(SYNTAX.kite).some((r) => r.token === 'identifier')).toBe(false)
  })

  it('repete as 3 cores de colchetes nos 6 níveis', () => {
    const colors = bracketColors(SYNTAX.dark)
    expect(colors['editorBracketHighlight.foreground1']).toBe('#d19a66')
    expect(colors['editorBracketHighlight.foreground4']).toBe('#d19a66')
    expect(colors['editorBracketHighlight.foreground6']).toBe('#56b6c2')
  })
})
