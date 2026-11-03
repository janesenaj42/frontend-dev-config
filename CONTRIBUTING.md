# Contributing to `frontend-dev-config`

Where each rule, step and setting lives: [`CLAUDE.md`](CLAUDE.md).

## Run from source

**Toolchain:** Node.js 22.13 or later, pnpm (version in `package.json`, `packageManager`)

```bash
git clone <repo-url>
cd frontend-dev-config
pnpm install       # also installs the git hooks
pnpm build         # builds packages/init-react/dist/index.js
```

**Check it works:** `node packages/init-react/dist/index.js --help` prints the CLI's options.

To try the CLI on a project before publishing:

```bash
pnpm -r pack --pack-destination /tmp/tgz
cd <react-project>
INIT_REACT_LOCAL_TARBALLS=/tmp/tgz node <this-repo>/packages/init-react/dist/index.js
```

## Before a PR

```bash
pnpm test           # the CLI's tests, against real Vite templates
pnpm typecheck
pnpm format:check
```

## Release a package

1. On a branch: `pnpm release <package> <type>` (`patch`, `minor` or `major`; `alpha`, `beta` or
   `rc` for a prerelease). It bumps the version from the commits that touched the package and
   writes its `CHANGELOG.md`. Open a PR.
2. After it's merged: Actions → **Release** → Run workflow → pick the package. It tags
   `<package>@<version>` and publishes that package only.
3. After a new major of an ESLint package, raise its range in
   `packages/init-react/src/constants.ts` and release `init-react` too.
