import { translate, type ArgsOf, type Lang, type MessageKey, type TFunction } from '@shared/i18n'
import { useSettingsStore } from '../stores/settings.store'

// Textos da interface no idioma das configurações. Componentes usam useT() (re-renderizam na
// troca de idioma); ações e stores usam t(), que lê o idioma atual.

export function currentLang(): Lang {
  return useSettingsStore.getState().settings.language
}

export function t<K extends MessageKey>(key: K, ...args: ArgsOf<K>): string {
  return translate(currentLang(), key, ...args)
}

// Uma função por idioma, criada uma vez: componentes re-renderizam só quando o idioma muda.
const bound = new Map<Lang, TFunction>()

function translatorFor(lang: Lang): TFunction {
  let fn = bound.get(lang)
  if (!fn) {
    fn = (<K extends MessageKey>(key: K, ...args: ArgsOf<K>) =>
      translate(lang, key, ...args)) as TFunction
    bound.set(lang, fn)
  }
  return fn
}

export function useT(): TFunction {
  return translatorFor(useSettingsStore((s) => s.settings.language))
}

export function useLang(): Lang {
  return useSettingsStore((s) => s.settings.language)
}
