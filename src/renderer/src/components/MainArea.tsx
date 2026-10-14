import { DockviewReact, themeAbyss, type DockviewReadyEvent } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { useCallback } from 'react'
import { Welcome } from '../app/Welcome'
import { EDITOR_COMPONENT } from '../features/editor/editor.actions'
import { useEditorStore } from '../features/editor/editor.store'
import { EditorPanel } from '../features/editor/EditorPanel'
import { EditorTab } from '../features/editor/EditorTab'
import { disposeModel } from '../features/editor/models'
import { setDockApi } from '../lib/dock'

const components = { [EDITOR_COMPONENT]: EditorPanel }
const tabComponents = { [EDITOR_COMPONENT]: EditorTab }

export function MainArea() {
  const onReady = useCallback(({ api }: DockviewReadyEvent) => {
    setDockApi(api)
    api.onDidActivePanelChange(({ panel }) => {
      useEditorStore.getState().setActive(panel?.id ?? null)
    })
    // Painel removido por outro caminho: libera o modelo. Mover entre grupos também dispara
    // remoção, então confere depois que o movimento termina.
    api.onDidRemovePanel((panel) => {
      setTimeout(() => {
        if (!api.getPanel(panel.id)) disposeModel(panel.id)
      }, 0)
    })
  }, [])

  return (
    <main className="min-w-0 flex-1">
      <DockviewReact
        className="aic-dock"
        theme={themeAbyss}
        components={components}
        tabComponents={tabComponents}
        watermarkComponent={Welcome}
        onReady={onReady}
        defaultRenderer="always"
      />
    </main>
  )
}
