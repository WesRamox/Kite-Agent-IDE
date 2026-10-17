import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

// Git isolado da configuração do usuário (assinatura GPG, hooks globais etc.).
export const GIT_TEST_ENV = {
  GIT_AUTHOR_NAME: 'Teste E2E',
  GIT_AUTHOR_EMAIL: 'e2e@example.com',
  GIT_COMMITTER_NAME: 'Teste E2E',
  GIT_COMMITTER_EMAIL: 'e2e@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...GIT_TEST_ENV },
    encoding: 'utf8',
  })
}

export interface Launched {
  app: ElectronApplication
  page: Page
  workspace: string
  userData: string
  cleanup: () => Promise<void>
}

export interface LaunchOptions {
  keepWorkspace?: boolean
  // Reaproveita um perfil (para testar fechar e reabrir). Não é apagado no cleanup.
  userData?: string
  env?: Record<string, string>
}

export async function makeWorkspace(files: Record<string, string | Buffer>): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'kite-e2e-')))
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, content)
  }
  return dir
}

export async function launch(workspace: string, opts: LaunchOptions = {}): Promise<Launched> {
  const userData = opts.userData ?? (await mkdtemp(path.join(tmpdir(), 'kite-profile-')))
  const app = await electron.launch({
    // password-store=basic: não toca no chaveiro do sistema durante os testes.
    args: [path.join(__dirname, '..'), '--password-store=basic'],
    env: {
      ...process.env,
      ...GIT_TEST_ENV,
      GITHUB_CLIENT_ID: '',
      // Nunca o settings.json real do Claude Code (o teste pode sobrescrever).
      KITE_CLAUDE_SETTINGS: path.join(userData, 'claude-settings.json'),
      ...opts.env,
      KITE_USER_DATA_DIR: userData,
      ELECTRON_RENDERER_URL: '',
    },
  })
  // Diálogos nativos não são automatizáveis: substitui por respostas controladas.
  await app.evaluate(({ dialog, shell }, dir) => {
    const g = globalThis as unknown as {
      __confirmAnswer: number
      __trashed: string[]
      __opened: string[]
    }
    g.__confirmAnswer = 0
    g.__trashed = []
    g.__opened = []
    shell.openExternal = async (url: string) => {
      g.__opened.push(url)
    }
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [dir] })) as never
    dialog.showMessageBox = (async () => ({
      response: g.__confirmAnswer,
      checkboxChecked: false,
    })) as never
    shell.trashItem = async (p: string) => {
      g.__trashed.push(p)
    }
  }, workspace)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return {
    app,
    page,
    workspace,
    userData,
    cleanup: async () => {
      await app.close().catch(() => {})
      if (!opts.keepWorkspace) await rm(workspace, { recursive: true, force: true })
      if (!opts.userData) await rm(userData, { recursive: true, force: true })
    },
  }
}

export function setConfirmAnswer(app: ElectronApplication, answer: number): Promise<void> {
  return app.evaluate((_e, a) => {
    ;(globalThis as unknown as { __confirmAnswer: number }).__confirmAnswer = a
  }, answer)
}

export function trashed(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => (globalThis as unknown as { __trashed: string[] }).__trashed)
}

// Fecha a janela pelo fluxo real (o renderer salva os terminais e confirma).
export async function closeWindow(app: ElectronApplication): Promise<void> {
  const closed = new Promise<void>((resolve) => app.once('close', () => resolve()))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
  await closed
}

export function openedUrls(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened)
}
