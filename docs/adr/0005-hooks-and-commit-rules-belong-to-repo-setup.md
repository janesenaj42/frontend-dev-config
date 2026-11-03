# Git hooks and commit rules belong to repo-setup; the CLI keeps ESLint, Prettier and typecheck

Supersedes [0002](0002-git-hooks-through-lefthook.md).

The CLI no longer sets up git hooks (lefthook, lint-staged), commitlint or commitizen, and the
Prettier and commitlint Shared Config Packages are gone. `repo-setup` sets up hooks and commit
checks for every repository, whatever its stacks (React, Java, Python), and the CLI sets up only
what is React-specific: ESLint, Prettier and the `typecheck` and release scripts.

Two tools installed the same hooks: the CLI, for React projects, and the baseline (now
`repo-setup`), for every repository, which called the CLI with `--skip=commitlint,lefthook` to
keep them apart. Commit rules also lived in two places that disagreed: the baseline's
`commitlint.config.mjs` and `@janesenaj42/commitlint-config`. The Prettier package held only
Prettier's own defaults, written out.

## Considered Options

- **The CLI keeps hooks for React projects; repo-setup does the rest**: two owners of the same
  hook files, and a flag to stop them colliding.
- **Keep the Prettier and commitlint packages**: a package per tool whose settings equal the
  tool's defaults, published and mirrored on every release, and a registry token for every
  repository that only formats code or checks commit messages.

## Consequences

- A React project gets its hooks by running `repo-setup`, which runs this CLI for it.
- Formatting is Prettier's defaults. A project's own Prettier config is kept; a config an earlier
  release wrote is removed while unedited.
- Commit messages are checked with commitlint's defaults (`@commitlint/config-conventional`).
