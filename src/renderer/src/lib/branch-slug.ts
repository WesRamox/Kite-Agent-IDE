// Branch sugerida a partir do nome da tarefa: "PAY-415 Estorno parcial" → "PAY-415-Estorno-parcial".
export function branchSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60)
}
