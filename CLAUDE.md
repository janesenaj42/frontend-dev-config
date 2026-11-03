# CLAUDE.md

The org's shared rules are in `.claude/rules/baseline.md`.

## Where each fact lives

| Fact                                                              | Lives in                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| ESLint rules, ESLint 9 and 10                                     | `packages/eslint-config/index.js`                      |
| ESLint rules, ESLint 8                                            | `packages/eslint-config-legacy/index.cjs`              |
| What the CLI writes into a project                                | `packages/init-react/src/steps/`                       |
| Versions the CLI installs (ESLint, the ESLint packages, Prettier) | `packages/init-react/src/constants.ts`                 |
| How the CLI recognises a Vite template                            | `packages/init-react/src/fingerprints.ts`              |
| How the CLI's own code is linted                                  | `packages/init-react/eslint.config.js`                 |
| How a release is prepared, tagged and published                   | `scripts/release.mjs`, `.github/workflows/publish.yml` |
| Git hooks and the commands they run                               | `lefthook.yml`, which extends `.baseline/lefthook.yml` |
| Commands Claude's hooks run after an edit and before a turn ends  | `.claude/hooks/checks.json`                            |
| Tool versions                                                     | `package.json` of the root and of each package         |
| Vocabulary                                                        | `CONTEXT.md`                                           |
| Why things are the way they are                                   | `docs/adr/`                                            |

## Commands

| Command (repo root)             | What it does                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm install`                  | Installs everything, and the git hooks                                           |
| `pnpm test`                     | The CLI's tests, against real Vite 8 and 9 templates                             |
| `pnpm build`                    | Builds `packages/init-react/dist/index.js`                                       |
| `pnpm release <package> <type>` | Prepares a release on a branch; after the PR is merged, run the Release workflow |

To try the CLI on a project before publishing: `pnpm -r pack --pack-destination /tmp/tgz`, then in
the project `INIT_REACT_LOCAL_TARBALLS=/tmp/tgz node <this repo>/packages/init-react/dist/index.js`.
