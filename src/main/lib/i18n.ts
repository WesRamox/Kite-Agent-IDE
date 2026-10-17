import { translate, type ArgsOf, type Lang, type MessageKey } from '@shared/i18n'

// Idioma dos textos que o main mostra (erros, notificações, diálogos). Segue a configuração;
// os testes dos serviços ficam no padrão, português.
let current: Lang = 'pt-BR'

export function setLanguage(lang: Lang): void {
  current = lang
}

export function currentLanguage(): Lang {
  return current
}

export function t<K extends MessageKey>(key: K, ...args: ArgsOf<K>): string {
  return translate(current, key, ...args)
}
