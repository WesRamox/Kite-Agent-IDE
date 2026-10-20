// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { plainToHtml, sanitizeNoteHtml } from './note-html'

describe('sanitizeNoteHtml', () => {
  it('mantém negrito, itálico, sublinhado, riscado e lista', () => {
    const html = '<b>a</b><i>b</i><u>c</u><s>d</s><ul><li>e</li></ul>'
    expect(sanitizeNoteHtml(html)).toBe(html)
  })

  it('mantém cor e tamanho vindos do editor', () => {
    expect(
      sanitizeNoteHtml('<span style="color: rgb(40, 169, 255); font-size: x-large">oi</span>'),
    ).toBe('<span style="color: rgb(40, 169, 255); font-size: x-large">oi</span>')
  })

  it('converte a marca font antiga (cor e tamanho) em estilo', () => {
    expect(sanitizeNoteHtml('<font size="5" color="#ff0000">oi</font>')).toBe(
      '<span style="color: #ff0000; font-size: x-large">oi</span>',
    )
  })

  it('descarta script, estilo e qualquer marca fora da lista, sem perder o texto comum', () => {
    expect(sanitizeNoteHtml('antes<script>alert(1)</script><style>b{}</style>depois')).toBe(
      'antesdepois',
    )
    expect(sanitizeNoteHtml('<img src=x onerror="alert(1)">texto')).toBe('texto')
    expect(sanitizeNoteHtml('<a href="javascript:alert(1)">link</a>')).toBe('link')
  })

  it('tira atributos de evento e de endereço das marcas que ficam', () => {
    expect(sanitizeNoteHtml('<b onclick="alert(1)" style="background:url(x)">x</b>')).toBe(
      '<b>x</b>',
    )
  })

  it('cor ou tamanho fora do formato não passam', () => {
    expect(sanitizeNoteHtml('<span style="color: red; background: url(http://x)">x</span>')).toBe(
      '<span style="color: red">x</span>',
    )
    expect(sanitizeNoteHtml('<span style="font-size: 999px">x</span>')).toBe('x')
  })

  it('texto com sinais de menor e maior continua texto', () => {
    expect(sanitizeNoteHtml('1 &lt; 2 &amp;&amp; 3 &gt; 2')).toBe('1 &lt; 2 &amp;&amp; 3 &gt; 2')
  })
})

describe('plainToHtml', () => {
  it('escapa e preserva as quebras de linha', () => {
    expect(plainToHtml('a<b>\nc & d')).toBe('a&lt;b&gt;<br>c &amp; d')
  })
})
