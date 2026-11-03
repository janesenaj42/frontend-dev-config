# A Legacy Standard for projects still on ESLint 8

The org's ESLint rules ship as two Shared Config Packages: `@janesenaj42/eslint-config` for
ESLint 9 and 10 (flat config) and `@janesenaj42/eslint-config-legacy` for ESLint 8
(`.eslintrc`). The CLI picks one from the project's ESLint version. Each package has its own
version, so a change to one never bumps the other.

The org's projects did not move to flat config at the same time. Their rules were shared as a
`.eslintrc.json` file passed between teams, which drifted, and which broke when its plugins were
not installed: `baseline-single-spa-root-config` couldn't run ESLint at all because
`legacy-peer-deps` skipped airbnb's peer plugins. airbnb's config exists only for `.eslintrc`, so
the flat package drops it and keeps SonarJS, the SWQAT and Webcore rules and the code review rules.

## Considered Options

- **Flat config only; projects migrate first**: every ESLint 8 project keeps passing its file
  around until it migrates.
- **One package with both formats**: one version for two rule sets that change for different
  reasons.
- **Port airbnb to flat config with a community package**: depends on a third-party port staying
  maintained.

## Consequences

- The Legacy Standard is the org's file as it was, so moving onto it changes no rules. Its
  plugins install with it: `@rushstack/eslint-patch` makes ESLint 8 load them from the package,
  tested with npm, npm with `legacy-peer-deps`, and pnpm.
- Moving to flat config is: upgrade ESLint, re-run the CLI with `--force=eslint`, and fix what the
  flat Standard's rules report.
- The flat package needs ESLint 9.22 or later (`defineConfig`), and leaves `@eslint/js` to the
  project, because its version must match ESLint's.
