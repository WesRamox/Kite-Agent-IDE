import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface Launched {
  app: ElectronApplication
  page: Page
  workspace: string
  cleanup: () => Promise<void>
}

export async function makeWorkspace(files: Record<string, string | Buffer>): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'aic-e2e-')))
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, content)
  }
  return dir
}

export async function launch(
  workspace: string,
  opts: { keepWorkspace?: boolean } = {},
): Promise<Launched> {
  const userData = await mkdtemp(path.join(tmpdir(), 'aic-profile-'))
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: { ...process.env, AIC_USER_DATA_DIR: userData, ELECTRON_RENDERER_URL: '' },
  })
  // Diálogos nativos não são automatizáveis: substitui por respostas controladas.
  await app.evaluate(({ dialog, shell }, dir) => {
    const g = globalThis as unknown as { __confirmAnswer: number; __trashed: string[] }
    g.__confirmAnswer = 0
    g.__trashed = []
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
    cleanup: async () => {
      await app.close()
      if (!opts.keepWorkspace) await rm(workspace, { recursive: true, force: true })
      await rm(userData, { recursive: true, force: true })
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
