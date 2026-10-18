import { Copy, ExternalLink, LoaderCircle } from 'lucide-react'
import { GitHubMark } from '../../components/GitHubMark'
import { cancelLogin, login } from './github.actions'
import { useGitHubStore } from './github.store'
import { useT } from '../../lib/i18n'
import { copyText } from '../../lib/clipboard'

export function LoginBox() {
  const state = useGitHubStore((s) => s.login)
  const secure = useGitHubStore((s) => s.auth?.secureStorage ?? true)
  const t = useT()

  if (state.kind === 'waiting') {
    const { userCode, verificationUri } = state.flow
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <p className="text-fg-muted">{t('github.enterCode')}</p>
        <p
          aria-label={t('github.code')}
          className="rounded-md border border-border bg-surface-0 px-4 py-2 font-mono text-xl tracking-widest text-fg select-text"
        >
          {userCode}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copyText(userCode)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2"
          >
            <Copy size={12} /> {t('github.copy')}
          </button>
          <button
            type="button"
            onClick={() => window.open(verificationUri, '_blank')}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2"
          >
            <ExternalLink size={12} /> {t('github.openGitHub')}
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <LoaderCircle size={12} className="animate-spin" /> {t('github.waiting')}
        </p>
        <button
          type="button"
          onClick={cancelLogin}
          className="text-[11px] text-fg-muted underline hover:text-fg"
        >
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <p className="text-fg-muted">{t('github.signInHint')}</p>
      <button
        type="button"
        disabled={state.kind === 'starting'}
        onClick={() => void login()}
        className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:bg-accent/85 disabled:opacity-50"
      >
        <GitHubMark size={14} /> {t('github.signIn')}
      </button>
      {state.kind === 'error' && <p className="text-[11px] text-danger">{state.message}</p>}
      {!secure && <p className="text-[11px] text-fg-muted">{t('github.noKeychain')}</p>}
    </div>
  )
}
