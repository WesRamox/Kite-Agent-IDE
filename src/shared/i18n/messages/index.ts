import agents from './agents'
import canvas from './canvas'
import main from './main'
import settings from './settings'
import shell from './shell'
import tasks from './tasks'
import workbench from './workbench'

// Junta as áreas num catálogo por idioma. As chaves têm o nome da área como prefixo.
export const all = {
  pt: {
    ...main.pt,
    ...shell.pt,
    ...settings.pt,
    ...agents.pt,
    ...tasks.pt,
    ...workbench.pt,
    ...canvas.pt,
  },
  en: {
    ...main.en,
    ...shell.en,
    ...settings.en,
    ...agents.en,
    ...tasks.en,
    ...workbench.en,
    ...canvas.en,
  },
}
