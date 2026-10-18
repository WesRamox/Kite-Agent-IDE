export interface LanguageInfo {
  id: string
  extensions?: string[]
  filenames?: string[]
}

// Detecta a linguagem pelo nome do arquivo (nome exato primeiro, depois a extensão mais
// longa que casar, para `.d.ts` vencer `.ts`).
export function detectLanguage(fileName: string, languages: readonly LanguageInfo[]): string {
  const lower = fileName.toLowerCase()
  for (const lang of languages) {
    if (lang.filenames?.some((f) => f.toLowerCase() === lower)) return lang.id
  }
  let best: { id: string; len: number } | null = null
  for (const lang of languages) {
    for (const ext of lang.extensions ?? []) {
      const e = ext.toLowerCase()
      if (lower.endsWith(e) && (!best || e.length > best.len)) best = { id: lang.id, len: e.length }
    }
  }
  return best?.id ?? 'plaintext'
}
