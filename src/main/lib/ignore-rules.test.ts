import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { IgnoreRules } from './ignore-rules'

const root = path.join(path.sep, 'repo')
const p = (...parts: string[]): string => path.join(root, ...parts)

function rulesWith(files: Record<string, string>): IgnoreRules {
  return new IgnoreRules(root, async (file) => files[file] ?? null)
}

describe('IgnoreRules', () => {
  it('ignora os nomes padrão em qualquer nível', async () => {
    const rules = rulesWith({})
    await expect(rules.isIgnored(p('node_modules'), true)).resolves.toBe(true)
    await expect(rules.isIgnored(p('pkg', '.git'), true)).resolves.toBe(true)
    await expect(rules.isIgnored(p('src'), true)).resolves.toBe(false)
  })

  it('respeita o .gitignore da raiz', async () => {
    const rules = rulesWith({ [p('.gitignore')]: '*.log\ncoverage/\n' })
    await expect(rules.isIgnored(p('a.log'), false)).resolves.toBe(true)
    await expect(rules.isIgnored(p('src', 'b.log'), false)).resolves.toBe(true)
    await expect(rules.isIgnored(p('coverage'), true)).resolves.toBe(true)
    // padrão com barra final só vale para diretórios
    await expect(rules.isIgnored(p('coverage'), false)).resolves.toBe(false)
    await expect(rules.isIgnored(p('src', 'a.ts'), false)).resolves.toBe(false)
  })

  it('aplica .gitignore aninhado relativo à sua pasta', async () => {
    const rules = rulesWith({ [p('pkg', '.gitignore')]: '/gen\n' })
    await expect(rules.isIgnored(p('pkg', 'gen'), true)).resolves.toBe(true)
    await expect(rules.isIgnored(p('gen'), true)).resolves.toBe(false)
  })

  it('relê o .gitignore depois de invalidar', async () => {
    const files: Record<string, string> = { [p('.gitignore')]: '*.tmp' }
    const rules = new IgnoreRules(root, async (f) => files[f] ?? null)
    await expect(rules.isIgnored(p('x.tmp'), false)).resolves.toBe(true)
    files[p('.gitignore')] = ''
    rules.invalidate(p('.gitignore'))
    await expect(rules.isIgnored(p('x.tmp'), false)).resolves.toBe(false)
  })
})
