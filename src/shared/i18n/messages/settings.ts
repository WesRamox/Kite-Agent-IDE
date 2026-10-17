import { messages } from '../types'

// Página de configurações.
export default messages(
  {
    'settings.saveError': 'Erro ao salvar a configuração',
    'settings.kicker': 'Kite',
    'settings.title': 'Configurações',
    'settings.intro':
      'Valem para todas as pastas, exceto o agrupamento das tarefas, que é de cada workspace. As mudanças são salvas na hora.',
    'settings.sections': 'Seções das configurações',
    'settings.appearance': 'Aparência',
    'settings.language': 'Idioma',
    'settings.editor': 'Editor e terminal',
    'settings.agents': 'Agentes e notificações',
    'settings.tasks': 'Tarefas',
    'settings.github': 'GitHub',
    'settings.about': 'Sobre',
    'settings.theme': 'Tema',
    'settings.languageGroup': 'Idioma da interface',
    'settings.decrease': ({ label }: { label: string }) => `Diminuir ${label.toLowerCase()}`,
    'settings.increase': ({ label }: { label: string }) => `Aumentar ${label.toLowerCase()}`,
    'settings.editorFont': 'Fonte do editor',
    'settings.editorFontHint': 'Editor de arquivos e diffs.',
    'settings.terminalFont': 'Fonte do terminal',
    'settings.terminalFontHint': 'Vale também para os terminais já abertos.',
    'settings.restoreTerminals': 'Restaurar terminais',
    'settings.restoreTerminalsHint':
      'Guarda o histórico dos terminais ao fechar a pasta ou o app e reabre do mesmo jeito.',
    'settings.integrations': 'Integrações',
    'settings.connected': ({ list }: { list: string }) => `Conectados: ${list}.`,
    'settings.noneConnected':
      'Nenhum CLI conectado: o Kite só sabe quem espera pelos agentes abertos aqui dentro.',
    'settings.connectAgents': 'Conectar agentes',
    'settings.presets': 'Presets dos CLIs',
    'settings.presetsHint': 'Comando de cada agente e como o prompt inicial é passado.',
    'settings.adjust': 'Ajustar',
    'settings.notifications': 'Notificações',
    'settings.notificationsHint':
      'Notificação do sistema quando um agente pede permissão, espera você ou termina.',
    'settings.openFolderForTasks':
      'Abra uma pasta para configurar como as worktrees viram tarefas.',
    'settings.tasksHint':
      'Vale para a pasta aberta. O padrão de pasta também define onde "+ Nova" cria as worktrees das tarefas novas.',
    'settings.loginNotConfigured': 'Login não configurado',
    'settings.loginNotConfiguredHint':
      'Crie um OAuth App com Device Flow e coloque o Client ID em GITHUB_CLIENT_ID, num arquivo .env. Depois reinicie o Kite.',
    'settings.howToConfigure': 'Como configurar',
    'settings.connectedAs': ({ login }: { login: string }) => `Conectado como ${login}`,
    'settings.notConnected': 'Não conectado',
    'settings.tokenSecure': 'O token fica criptografado no cofre do sistema.',
    'settings.tokenMemory': 'Sem cofre do sistema: o login vale até fechar o app.',
    'settings.signInHint': 'Entre para ver PRs e issues, abrir PRs e entregar tarefas.',
    'settings.signOut': 'Sair',
    'settings.signIn': 'Entrar com GitHub',
    'settings.versions': ({
      electron,
      chrome,
      node,
    }: {
      electron: string
      chrome: string
      node: string
    }) => `Electron ${electron} · Chromium ${chrome} · Node ${node} · licença MIT`,
    'settings.projectOnGitHub': 'Projeto no GitHub',
    'settings.reportIssue': 'Relatar um problema',
  },
  {
    'settings.saveError': 'Could not save the setting',
    'settings.kicker': 'Kite',
    'settings.title': 'Settings',
    'settings.intro':
      'They apply to every folder, except task grouping, which belongs to each workspace. Changes are saved right away.',
    'settings.sections': 'Settings sections',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.editor': 'Editor and terminal',
    'settings.agents': 'Agents and notifications',
    'settings.tasks': 'Tasks',
    'settings.github': 'GitHub',
    'settings.about': 'About',
    'settings.theme': 'Theme',
    'settings.languageGroup': 'Interface language',
    'settings.decrease': ({ label }: { label: string }) => `Decrease ${label.toLowerCase()}`,
    'settings.increase': ({ label }: { label: string }) => `Increase ${label.toLowerCase()}`,
    'settings.editorFont': 'Editor font',
    'settings.editorFontHint': 'File editor and diffs.',
    'settings.terminalFont': 'Terminal font',
    'settings.terminalFontHint': 'Also applies to terminals that are already open.',
    'settings.restoreTerminals': 'Restore terminals',
    'settings.restoreTerminalsHint':
      'Keeps the terminal history when you close the folder or the app, and reopens it as it was.',
    'settings.integrations': 'Integrations',
    'settings.connected': ({ list }: { list: string }) => `Connected: ${list}.`,
    'settings.noneConnected':
      'No CLI connected: Kite only knows who is waiting among the agents opened inside it.',
    'settings.connectAgents': 'Connect agents',
    'settings.presets': 'CLI presets',
    'settings.presetsHint': "Each agent's command and how the first prompt is passed.",
    'settings.adjust': 'Adjust',
    'settings.notifications': 'Notifications',
    'settings.notificationsHint':
      'System notification when an agent asks for permission, waits for you or finishes.',
    'settings.openFolderForTasks': 'Open a folder to set up how worktrees become tasks.',
    'settings.tasksHint':
      'Applies to the open folder. The folder pattern also sets where "+ New" creates the worktrees of new tasks.',
    'settings.loginNotConfigured': 'Sign-in not configured',
    'settings.loginNotConfiguredHint':
      'Create an OAuth App with Device Flow and put its client ID in GITHUB_CLIENT_ID, in a .env file. Then restart Kite.',
    'settings.howToConfigure': 'How to set it up',
    'settings.connectedAs': ({ login }: { login: string }) => `Signed in as ${login}`,
    'settings.notConnected': 'Not signed in',
    'settings.tokenSecure': 'The token is encrypted in the system keychain.',
    'settings.tokenMemory': 'No system keychain: you stay signed in until you close the app.',
    'settings.signInHint': 'Sign in to see PRs and issues, open PRs and ship tasks.',
    'settings.signOut': 'Sign out',
    'settings.signIn': 'Sign in with GitHub',
    'settings.versions': ({
      electron,
      chrome,
      node,
    }: {
      electron: string
      chrome: string
      node: string
    }) => `Electron ${electron} · Chromium ${chrome} · Node ${node} · MIT license`,
    'settings.projectOnGitHub': 'Project on GitHub',
    'settings.reportIssue': 'Report an issue',
  },
)
