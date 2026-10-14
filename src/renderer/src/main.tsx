import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
// Aplica o tema salvo antes de montar a UI (sem piscar o tema padrão).
import './stores/theme.store'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root não encontrado')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
