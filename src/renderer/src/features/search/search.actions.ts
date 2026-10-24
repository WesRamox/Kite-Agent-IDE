import type { SearchFile, SearchMatch } from '@shared/types'
import { useLayoutStore } from '../../stores/layout.store'
import { openFile } from '../editor/editor.actions'
import { useSearchStore } from './search.store'

// Ctrl/Cmd+Shift+F: mostra a view "Buscar" (sem recolher se já estiver aberta) e foca o campo.
export function openSearch(): void {
  const layout = useLayoutStore.getState()
  if (layout.activeView !== 'search' || !layout.sidebarVisible) layout.selectView('search')
  useSearchStore.getState().requestFocus()
}

export function openMatch(file: SearchFile, match: SearchMatch): Promise<void> {
  return openFile(file.path, { line: match.line, column: match.column, length: match.length })
}
