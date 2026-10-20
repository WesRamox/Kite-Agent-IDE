import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
// Aplica o tema salvo antes de montar a UI (sem piscar o tema padrão).
import './stores/theme.store'
import './styles.css'

// Erros fora do React (callbacks, promises sem catch) também vão para o log do main.
window.addEventListener('error', (e) =>
  console.error(`Erro não tratado: ${e.error?.stack ?? e.message}`),
)
window.addEventListener('unhandledrejection', (e) => {
  const reason: unknown = e.reason
  console.error(
    `Promise rejeitada: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  )
})

const root = document.getElementById('root')
if (!root) throw new Error('#root não encontrado')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Um só arrastar-e-soltar para todas as árvores de arquivos. Cada árvore criando o seu, a
          do workspace e a da tarefa se cruzavam ao trocar de contexto e o react-dnd derrubava a
          interface ("Cannot have two HTML5 backends at the same time"). */}
      <DndProvider backend={HTML5Backend}>
        <App />
      </DndProvider>
    </ErrorBoundary>
  </StrictMode>,
)
