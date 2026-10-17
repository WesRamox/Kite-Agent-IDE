import { readFileSync } from 'node:fs'

// Arquivo .env com a configuração do app (ex.: GITHUB_CLIENT_ID), para não precisar passar as
// variáveis na linha de comando. Só as chaves conhecidas entram: o resto do arquivo não vaza
// para o ambiente dos terminais. Uma variável já definida no ambiente, mesmo vazia (os testes
// e2e usam isso), sempre vence o arquivo.

export const ENV_FILE_KEYS = [
  'GITHUB_CLIENT_ID',
  'GITHUB_API_URL',
  'GITHUB_OAUTH_URL',
  'GITHUB_HOST',
  'KITE_DEVTOOLS',
] as const

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/

// Formato usual: CHAVE=valor, aspas simples ou duplas opcionais, # para comentários.
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const match = LINE.exec(raw)
    if (!match?.[1]) continue
    let value = match[2] ?? ''
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
      value = value.slice(1, -1)
      if (quote === '"') value = value.replace(/\\n/g, '\n')
    } else {
      value = value.replace(/\s+#.*$/, '')
    }
    out[match[1]] = value
  }
  return out
}

// Lê os arquivos em ordem (o primeiro que define uma chave vence) e preenche `env` só com as
// chaves conhecidas que ainda não estão definidas. Devolve os arquivos lidos e as chaves aplicadas.
export function loadEnvFiles(
  files: string[],
  env: NodeJS.ProcessEnv,
  read: (file: string) => string = (file) => readFileSync(file, 'utf8'),
): { files: string[]; keys: string[] } {
  const loaded: string[] = []
  const keys: string[] = []
  for (const file of files) {
    let text: string
    try {
      text = read(file)
    } catch {
      continue
    }
    loaded.push(file)
    const values = parseEnv(text)
    for (const key of ENV_FILE_KEYS) {
      const value = values[key]
      if (value === undefined || env[key] !== undefined) continue
      env[key] = value
      keys.push(key)
    }
  }
  return { files: loaded, keys }
}
