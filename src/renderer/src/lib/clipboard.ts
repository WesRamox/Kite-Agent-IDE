// Copia pelo main: o renderer em sandbox não tem acesso confiável à área de transferência.
export function copyText(text: string): void {
  void window.api.clipboard.writeText(text)
}
