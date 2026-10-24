// Posição de um menu flutuante aberto em (x, y): abre para baixo e para a direita do ponto, mas
// encosta na borda da janela (a `margin` dela) quando não cabe. Maior que a janela, fica no topo
// e rola.
export function fitMenu(
  at: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  const fit = (pos: number, len: number, max: number) =>
    Math.max(margin, Math.min(pos, max - len - margin))
  return {
    left: fit(at.x, size.width, viewport.width),
    top: fit(at.y, size.height, viewport.height),
  }
}
