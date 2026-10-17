# Contributing to Kite

Thanks for your interest! Issues, ideas and pull requests are welcome. For anything bigger than a
small fix, please open an issue first so we can agree on the approach.

## Setup

Requirements are listed in the [README](README.md#getting-started). Then:

```bash
pnpm install   # downloads Electron and rebuilds node-pty (postinstall)
pnpm dev       # app in development mode, with HMR
```

| Script           | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | App in development mode                             |
| `pnpm build`     | Typecheck and production build in `out/`            |
| `pnpm preview`   | Runs the production build                           |
| `pnpm lint`      | ESLint                                              |
| `pnpm typecheck` | `tsc` for the node (main/preload), web and e2e code |
| `pnpm test`      | Unit tests (Vitest)                                 |
| `pnpm format`    | Prettier                                            |

End-to-end tests drive the built app with Playwright:

```bash
pnpm build && npx playwright test
```

They use a temporary profile and never touch your real `~/.claude/settings.json`. The README
screenshots come from `e2e/readme-screenshots.spec.ts`
(`KITE_SCREENSHOTS=1 npx playwright test e2e/readme-screenshots.spec.ts`).

## Environment variables

They can also go in a `.env` file (see `.env.example`). Variables set in the environment win.

| Variable                                                           | Purpose                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `GITHUB_CLIENT_ID`                                                 | OAuth App client ID for the GitHub login (Device Flow)      |
| `GITHUB_API_URL`, `GITHUB_OAUTH_URL`, `GITHUB_HOST`                | GitHub Enterprise                                           |
| `KITE_DEVTOOLS=1`                                                  | Enables DevTools in `pnpm dev` (ignored in packaged builds) |
| `LOG_LEVEL`                                                        | `debug`, `info` (default), `warn` or `error`                |
| `KITE_USER_DATA_DIR`                                               | Uses another profile folder (tests)                         |
| `KITE_CLAUDE_SETTINGS`, `KITE_CODEX_HOOKS`, `KITE_GEMINI_SETTINGS` | Other paths for each CLI's hook file (tests)                |

## Project structure

```
src/
  main/       main process: window, services, IPC handlers
    services/   one class per domain, with injected dependencies (testable without Electron)
    ipc/        one handler file per domain, arguments validated with zod
    hook/       kite-hook, the script the agent CLIs call
  preload/    exposes window.api (named functions only)
  shared/     the IPC contract and shared types
  renderer/   React UI, organized by feature (features/<name>)
e2e/        end-to-end tests (Playwright driving Electron)
docs/       decisions log, guide and README images
```

To add an IPC channel: declare it in `src/shared/ipc-contract.ts` (in `InvokeChannels` and in
`Api`), register the handler with a zod schema in `src/main/ipc/<domain>.ipc.ts`, and expose the
function in `src/preload/index.ts`.

## Conventions

- TypeScript strict, no `any`: use `unknown` and validate it.
- Main-process services are classes with injected dependencies. Every new service function gets a
  unit test.
- Keep React components small; put logic in hooks and stores.
- Errors reach the renderer as `{ ok: false, error: { code, message } }` and are shown as toasts.
- Never log file contents, tokens or agent messages.
- File operations only inside the folders the user opened.
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…).
- Before opening a PR, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, plus the e2e tests if you
  changed the UI.

The product spec and the phases it was built in are in [`AGENTS.md`](AGENTS.md). Decisions not
covered there are recorded in [`docs/decisions.md`](docs/decisions.md). New screens follow the
approved design. If a change departs from it, say so in the PR.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
