import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { translate, type ArgsOf, type Lang, type MessageKey } from '../src/shared/i18n'
import { git, launch } from './app'

// Gera as imagens do README (docs/images/<idioma>) com um workspace de exemplo, uma vez por
// idioma da interface. Não roda na suíte normal:
//   pnpm build && KITE_SCREENSHOTS=1 npx playwright test e2e/readme-screenshots.spec.ts

const DEMO = path.join(tmpdir(), 'kite-demo')

// Textos do exemplo (títulos das tarefas, pedidos e respostas dos agentes) em cada idioma.
const CONTENT = {
  en: {
    pix: 'Pix checkout',
    queue: 'Stuck queue alert',
    seo: 'Product page meta tags',
    payment: 'Payment',
    ttlComment: '// The charge expires in 30 min, as the card asks.',
    minimum: 'minimum amount is R$ 1.00',
    queuePrompt: 'Create an alert for a stuck queue',
    queueReply:
      'I added the orders-stuck alarm in Terraform (threshold of 100 messages). Should I run terraform plan on staging?',
    pixPrompt: 'Implement the Pix checkout',
    seoPrompt: 'Add meta tags to the product pages',
  },
  'pt-BR': {
    pix: 'Checkout com Pix',
    queue: 'Alerta de fila parada',
    seo: 'Meta tags das páginas de produto',
    payment: 'Pagamento',
    ttlComment: '// Cobrança expira em 30 min, como pede o card.',
    minimum: 'valor mínimo de R$ 1,00',
    queuePrompt: 'Crie um alerta para fila parada',
    queueReply:
      'Adicionei o alarme orders-stuck no Terraform (limite de 100 mensagens). Quer que eu rode o terraform plan em staging?',
    pixPrompt: 'Implemente o checkout com Pix',
    seoPrompt: 'Adicione meta tags nas páginas de produto',
  },
} as const satisfies Record<Lang, Record<string, string>>

type Content = (typeof CONTENT)[Lang]

async function makeDemo(c: Content): Promise<string> {
  await rm(DEMO, { recursive: true, force: true })
  const root = path.join(DEMO, 'acme')
  const files: Record<string, string> = {
    'api/package.json': '{\n  "name": "api",\n  "private": true\n}\n',
    'api/src/server.ts': "import { app } from './app'\n\napp.listen(3000)\n",
    'api/src/pix/charge.service.ts': `import { PixProvider } from './pix.provider'

export class ChargeService {
  constructor(private readonly psp: PixProvider) {}

  async create(orderId: string, amount: number) {
    return this.psp.createCharge({ orderId, amount })
  }
}
`,
    'api/src/pix/pix.provider.ts':
      'export interface PixProvider {\n  createCharge(input: { orderId: string; amount: number }): Promise<{ id: string }>\n}\n',
    'web/package.json': '{\n  "name": "web",\n  "private": true\n}\n',
    'web/src/checkout/PaymentStep.tsx': `export function PaymentStep() {
  return <section>${c.payment}</section>
}
`,
    'web/src/app.tsx': "export { PaymentStep } from './checkout/PaymentStep'\n",
    'infra/main.tf': 'resource "aws_sqs_queue" "orders" {\n  name = "orders"\n}\n',
  }
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, rel)), { recursive: true })
    await writeFile(path.join(root, rel), content)
  }
  for (const r of ['api', 'web', 'infra']) {
    git(path.join(root, r), 'init', '-q', '-b', 'main')
    git(path.join(root, r), 'add', '.')
    git(path.join(root, r), 'commit', '-q', '-m', 'chore: initial commit')
  }
  const wt = (repo: string, branch: string, dir: string) =>
    git(path.join(root, repo), 'worktree', 'add', '-q', '-b', branch, path.join(root, dir))
  wt('api', 'PAY-412', '.worktrees/PAY-412/api')
  wt('web', 'PAY-412', '.worktrees/PAY-412/web')
  await writeFile(path.join(root, '.worktrees/PAY-412/TASK.md'), `# ${c.pix}\n`)
  wt('api', 'OPS-19', '.worktrees/OPS-19/api')
  wt('infra', 'OPS-19', '.worktrees/OPS-19/infra')
  await writeFile(path.join(root, '.worktrees/OPS-19/TASK.md'), `# ${c.queue}\n`)
  wt('web', 'SEO-4', '.worktrees/SEO-4/web')
  await writeFile(path.join(root, '.worktrees/SEO-4/TASK.md'), `# ${c.seo}\n`)

  // O que o "agente" já fez na tarefa PAY-412: um commit na api e mudanças não commitadas.
  const pay = path.join(root, '.worktrees/PAY-412')
  await writeFile(
    path.join(pay, 'api/src/pix/charge.service.ts'),
    `import { PixProvider } from './pix.provider'
import { ValidationError } from '../errors'

export class ChargeService {
  constructor(private readonly psp: PixProvider) {}

  ${c.ttlComment}
  async create(orderId: string, amount: number) {
    if (amount < 100) throw new ValidationError('${c.minimum}')
    const charge = await this.psp.createCharge({ orderId, amount, ttl: 1800 })
    return { ...charge, status: 'pending' as const }
  }
}
`,
  )
  await writeFile(
    path.join(pay, 'api/src/pix/webhook.controller.ts'),
    `import { ChargeService } from './charge.service'

export class WebhookController {
  constructor(private readonly charges: ChargeService) {}

  async handle(event: { chargeId: string; status: 'paid' | 'expired' }) {
    return this.charges.update(event.chargeId, event.status)
  }
}
`,
  )
  git(path.join(pay, 'api'), 'add', '.')
  git(path.join(pay, 'api'), 'commit', '-q', '-m', 'feat(pix): charge with expiration')
  await writeFile(
    path.join(pay, 'web/src/checkout/PixQrCode.tsx'),
    `export function PixQrCode({ code }: { code: string }) {
  return <img alt="Pix QR code" src={\`/api/pix/qr?code=\${code}\`} />
}
`,
  )
  await writeFile(
    path.join(pay, 'web/src/checkout/PaymentStep.tsx'),
    `import { PixQrCode } from './PixQrCode'

export function PaymentStep({ pixCode }: { pixCode?: string }) {
  return (
    <section>
      <h2>${c.payment}</h2>
      {pixCode && <PixQrCode code={pixCode} />}
    </section>
  )
}
`,
  )
  await writeFile(
    path.join(root, '.worktrees/OPS-19/infra/main.tf'),
    'resource "aws_sqs_queue" "orders" {\n  name = "orders"\n}\n\nresource "aws_cloudwatch_metric_alarm" "orders_stuck" {\n  alarm_name = "orders-stuck"\n  threshold  = 100\n}\n',
  )
  return root
}

for (const lang of ['en', 'pt-BR'] as const) {
  test(`imagens do README (${lang})`, async () => {
    test.skip(!process.env['KITE_SCREENSHOTS'], 'só com KITE_SCREENSHOTS=1')
    test.setTimeout(120_000)
    const tr = <K extends MessageKey>(key: K, ...args: ArgsOf<K>) => translate(lang, key, ...args)
    const c = CONTENT[lang]
    const out = path.join(__dirname, '..', 'docs', 'images', lang)
    const root = await makeDemo(c)
    const userData = await mkdtemp(path.join(tmpdir(), 'kite-profile-'))
    const ctx = await launch(root, { userData, keepWorkspace: true, lang })
    const shot = async (page: Page, name: string) => {
      // Sem avisos nem hover no meio da imagem.
      for (const close of await page
        .getByRole('status')
        .getByRole('button', { name: tr('toast.close') })
        .all()) {
        await close.click().catch(() => {})
      }
      await page.mouse.move(700, 880)
      await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(out, `${name}.png`) })
    }
    try {
      const { page, app } = ctx
      await app.evaluate(({ BrowserWindow, Notification }) => {
        Notification.prototype.show = () => {}
        BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900)
      })
      await mkdir(out, { recursive: true })
      await page
        .getByRole('button', { name: tr('welcome.openFolder') })
        .first()
        .click()

      // Tela 4: descobrir tarefas.
      await expect(page.getByText(tr('discover.found', { repos: 3, worktrees: 5 }))).toBeVisible()
      await shot(page, 'discover')
      await page.getByRole('button', { name: tr('discover.import', { n: 3 }) }).click()

      // Conectar o Claude Code e simular três sessões.
      await page.getByRole('button', { name: tr('status.connectClaude') }).click()
      await page
        .getByRole('button', { name: tr('connect.connect'), exact: true })
        .first()
        .click()
      await expect(page.getByText(tr('connect.connected'), { exact: true })).toBeVisible()
      const settings = JSON.parse(
        await readFile(path.join(userData, 'claude-settings.json'), 'utf8'),
      )
      const command = settings.hooks.Stop[0].hooks[0].command as string
      const fire = (session: string, cwd: string, payload: Record<string, unknown>) =>
        execFileSync('/bin/sh', ['-c', command], {
          input: JSON.stringify({ session_id: session, cwd, ...payload }),
        })
      const pay = path.join(root, '.worktrees/PAY-412')
      const ops = path.join(root, '.worktrees/OPS-19')
      const seo = path.join(root, '.worktrees/SEO-4')

      fire('demo-ops', ops, { hook_event_name: 'UserPromptSubmit', prompt: c.queuePrompt })
      fire('demo-ops', ops, {
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: path.join(ops, 'infra/main.tf') },
      })
      fire('demo-ops', ops, { hook_event_name: 'Stop', last_assistant_message: c.queueReply })
      fire('demo-pix', pay, { hook_event_name: 'UserPromptSubmit', prompt: c.pixPrompt })
      for (const f of ['api/src/pix/charge.service.ts', 'web/src/checkout/PixQrCode.tsx']) {
        fire('demo-pix', pay, {
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: path.join(pay, f) },
        })
      }
      fire('demo-pix', pay, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash',
        tool_input: { command: 'cd api && pnpm prisma migrate dev --name pix_charges' },
      })
      fire('demo-seo', seo, { hook_event_name: 'UserPromptSubmit', prompt: c.seoPrompt })
      fire('demo-seo', seo, {
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: path.join(seo, 'web/src/app.tsx') },
      })
      await shot(page, 'connect')
      await page.keyboard.press('Escape')

      // Tela 1: Central de atenção.
      await page
        .locator('footer')
        .getByRole('button', { name: new RegExp(tr('status.waiting')) })
        .click()
      await expect(
        page.getByRole('region', { name: tr('agents.group.waiting') }).getByRole('article'),
      ).toHaveCount(2)
      await shot(page, 'central')
      await page.keyboard.press('Escape')

      // Tela 2: tarefa com dois repos, em "Alterados", com um arquivo aberto.
      await page.keyboard.press('Control+k')
      await page
        .getByRole('dialog', { name: tr('switcher.label') })
        .getByText(`PAY-412 · ${c.pix}`)
        .click()
      const changed = page.getByRole('tree', { name: tr('changed.tree') })
      await changed.getByRole('button', { name: /charge\.service\.ts/ }).click()
      await expect(
        page.locator('.dv-tab.dv-active-tab', { hasText: 'charge.service.ts' }),
      ).toBeVisible()
      await shot(page, 'task')

      // Tela 3: revisão da tarefa, com o diff de um arquivo.
      const bar = page.getByRole('menubar', { name: tr('menu.bar') })
      await bar.getByRole('menuitem', { name: tr('menu.task'), exact: true }).click()
      await bar.getByRole('menuitem', { name: tr('menu.reviewTask') }).click()
      await page
        .getByRole('group', { name: tr('review.repo', { repo: 'web' }) })
        .getByText('PaymentStep.tsx')
        .click()
      await page.keyboard.press('Control+b')
      await shot(page, 'review')
    } finally {
      await ctx.cleanup()
      await rm(userData, { recursive: true, force: true })
      await rm(DEMO, { recursive: true, force: true })
    }
  })
}
