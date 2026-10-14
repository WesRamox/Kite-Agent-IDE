import { Copy, ExternalLink, LoaderCircle } from 'lucide-react'
import { GitHubMark } from '../../components/GitHubMark'
import { cancelLogin, login } from './github.actions'
import { useGitHubStore } from './github.store'

export function LoginBox() {
  const state = useGitHubStore((s) => s.login)
  const secure = useGitHubStore((s) => s.auth?.secureStorage ?? true)

  if (state.kind === 'waiting') {
    const { userCode, verificationUri } = state.flow
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <p className="text-fg-muted">Digite este código no GitHub para autorizar:</p>
        <p
          aria-label="Código de verificação"
          className="rounded-md border border-border bg-surface-0 px-4 py-2 font-mono text-xl tracking-widest text-fg select-text"
        >
          {userCode}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void window.api.clipboard.writeText(userCode)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2"
          >
            <Copy size={12} /> Copiar
          </button>
          <button
            type="button"
            onClick={() => window.open(verificationUri, '_blank')}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2"
          >
            <ExternalLink size={12} /> Abrir GitHub
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <LoaderCircle size={12} className="animate-spin" /> Aguardando autorização…
        </p>
        <button
          type="button"
          onClick={cancelLogin}
          className="text-[11px] text-fg-muted underline hover:text-fg"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <p className="text-fg-muted">Entre para ver PRs e issues e criar PRs.</p>
      <button
        type="button"
        disabled={state.kind === 'starting'}
        onClick={() => void login()}
        className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-white hover:bg-accent/85 disabled:opacity-50"
      >
        <GitHubMark size={14} /> Entrar com GitHub
      </button>
      {state.kind === 'error' && <p className="text-[11px] text-danger">{state.message}</p>}
      {!secure && (
        <p className="text-[11px] text-fg-muted">
          O sistema não tem um cofre de senhas disponível: o login vale só até fechar o app.
        </p>
      )}
    </div>
  )
}
