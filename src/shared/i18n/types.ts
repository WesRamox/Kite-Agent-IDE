// Tipos do catálogo de textos. Cada área define o português (a fonte) e o inglês lado a lado; o
// TypeScript acusa chave faltando ou parâmetro diferente na tradução.

export type Lang = 'pt-BR' | 'en'

export const LANGS: readonly Lang[] = ['pt-BR', 'en']

// Um texto é fixo ou uma função dos parâmetros (para interpolar e para plural).
export type Catalog = Record<string, string | ((params: never) => string)>

export type Translation<C extends Catalog> = {
  [K in keyof C]: C[K] extends string ? string : C[K]
}

export function messages<C extends Catalog>(
  pt: C,
  en: Translation<C>,
): { pt: C; en: Translation<C> } {
  return { pt, en }
}

// Idioma padrão a partir do locale do sistema: português para pt-*, inglês para o resto.
export function languageFor(locale: string): Lang {
  return locale.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}
