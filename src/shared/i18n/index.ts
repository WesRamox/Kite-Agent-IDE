import { all } from './messages'
import type { Lang } from './types'

export { LANGS, languageFor, type Lang } from './types'

const catalogs = { 'pt-BR': all.pt, en: all.en } as const

type Pt = typeof all.pt
export type MessageKey = keyof Pt
type ParamsOf<K extends MessageKey> = Pt[K] extends (params: infer P) => string ? P : never
// Sem parâmetros, nenhum argumento; com parâmetros, o objeto deles.
export type ArgsOf<K extends MessageKey> = [ParamsOf<K>] extends [never] ? [] : [ParamsOf<K>]
export type TFunction = <K extends MessageKey>(key: K, ...args: ArgsOf<K>) => string

export function translate<K extends MessageKey>(lang: Lang, key: K, ...args: ArgsOf<K>): string {
  const msg = (catalogs[lang] as Record<MessageKey, Pt[MessageKey]>)[key] ?? all.pt[key]
  return typeof msg === 'function' ? (msg as (p: unknown) => string)(args[0]) : msg
}

// Plural simples (as duas línguas têm só singular e plural).
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}
