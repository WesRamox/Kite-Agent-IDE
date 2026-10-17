// Fonte do código (editor, diffs e terminais): Geist Mono, como nas telas do canvas.
export const CODE_FONT =
  "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"

// O xterm mede os glifos ao abrir: com a fonte ainda carregando, ele mediria a de fallback
// e o texto ficaria desalinhado. Espera a fonte (no máximo um instante).
export function codeFontReady(): Promise<void> {
  const load = document.fonts
    .load("13px 'Geist Mono Variable'")
    .then(() => undefined)
    .catch(() => undefined)
  return Promise.race([load, new Promise<void>((r) => setTimeout(r, 1500))])
}
