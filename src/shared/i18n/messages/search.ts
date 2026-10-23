import { messages } from '../types'

type N = { n: number }

// View "Buscar": busca no conteúdo dos arquivos da tarefa aberta.
export default messages(
  {
    'search.input': 'Buscar na tarefa',
    'search.placeholder': 'Buscar',
    'search.caseSensitive': 'Diferenciar maiúsculas e minúsculas',
    'search.wholeWord': 'Palavra inteira',
    'search.regex': 'Usar expressão regular',
    'search.filters': 'Filtros de arquivos',
    'search.include': 'Arquivos a incluir',
    'search.exclude': 'Arquivos a excluir',
    'search.globsPlaceholder': 'ex.: *.ts, src/**',
    'search.refresh': 'Buscar de novo',
    'search.noTask': 'Abra uma tarefa para buscar nos arquivos das worktrees dela.',
    'search.openTask': 'Escolher tarefa',
    'search.searching': 'Buscando…',
    'search.none': 'Nenhum resultado na tarefa.',
    'search.summary': ({ matches, files }: { matches: number; files: number }) =>
      `${matches} ${matches === 1 ? 'resultado' : 'resultados'} em ${files} ${files === 1 ? 'arquivo' : 'arquivos'}`,
    'search.truncated': ({ n }: N) =>
      `Mostrando os primeiros ${n} resultados. Refine a busca para ver o resto.`,
    'search.repo': ({ name }: { name: string }) => `Resultados em ${name}`,
    'search.toggleFile': ({ file }: { file: string }) => `Recolher ou expandir ${file}`,
    'search.match': ({ file, line }: { file: string; line: number }) =>
      `Abrir ${file} na linha ${line}`,
  },
  {
    'search.input': 'Search in task',
    'search.placeholder': 'Search',
    'search.caseSensitive': 'Match case',
    'search.wholeWord': 'Match whole word',
    'search.regex': 'Use regular expression',
    'search.filters': 'File filters',
    'search.include': 'Files to include',
    'search.exclude': 'Files to exclude',
    'search.globsPlaceholder': 'e.g. *.ts, src/**',
    'search.refresh': 'Search again',
    'search.noTask': 'Open a task to search the files in its worktrees.',
    'search.openTask': 'Choose task',
    'search.searching': 'Searching…',
    'search.none': 'No results in this task.',
    'search.summary': ({ matches, files }: { matches: number; files: number }) =>
      `${matches} ${matches === 1 ? 'result' : 'results'} in ${files} ${files === 1 ? 'file' : 'files'}`,
    'search.truncated': ({ n }: N) =>
      `Showing the first ${n} results. Narrow the search to see the rest.`,
    'search.repo': ({ name }: { name: string }) => `Results in ${name}`,
    'search.toggleFile': ({ file }: { file: string }) => `Collapse or expand ${file}`,
    'search.match': ({ file, line }: { file: string; line: number }) =>
      `Open ${file} at line ${line}`,
  },
)
