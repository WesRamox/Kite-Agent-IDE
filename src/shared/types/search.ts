// Busca no conteúdo dos arquivos da tarefa aberta (view "Buscar").

export interface SearchQuery {
  text: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  // Globs separados por vírgula, como no VS Code ("src/**, *.ts"). Vazio: todos os arquivos.
  include: string
  exclude: string
}

export interface SearchMatch {
  // Linha e coluna (1-based) da primeira ocorrência, para posicionar o editor.
  line: number
  column: number
  // Tamanho da primeira ocorrência (seleção no editor); 0 quando não deu para medir.
  length: number
  // Trecho da linha (sem o recuo e cortado em linhas longas) e as ocorrências dentro dele.
  preview: string
  ranges: [start: number, end: number][]
}

export interface SearchFile {
  path: string
  // Caminho relativo à worktree, com `/`.
  rel: string
  matches: SearchMatch[]
}

export interface SearchRepo {
  repoName: string
  worktree: string
  files: SearchFile[]
}

export interface SearchResult {
  repos: SearchRepo[]
  files: number
  matches: number
  // Passou do limite de ocorrências: o resto não veio.
  truncated: boolean
}
