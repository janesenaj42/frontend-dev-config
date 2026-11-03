import { join } from "node:path";
import { THIRD_PARTY_RANGES } from "../constants.js";
import { isUneditedManagedFile, stamp } from "../managed.js";
import { reconcileManagedFile, type Plan } from "../plan.js";

const CANDIDATES = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.toml",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.mjs",
  ".prettierrc.ts",
  ".prettierrc.cts",
  ".prettierrc.mts",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "prettier.config.ts",
  "prettier.config.cts",
  "prettier.config.mts",
];

// Release writes CHANGELOG.md in its own format; lockfiles are generated.
const IGNORE = `CHANGELOG.md
package-lock.json
pnpm-lock.yaml
yarn.lock
`;

/**
 * The Standard formats with Prettier's own defaults, so it writes no Prettier config. A config
 * an earlier release wrote is removed while unedited; the project's own config is kept unless
 * --force=prettier.
 */
function removeConfigs(plan: Plan): void {
  for (const name of CANDIDATES) {
    const path = join(plan.project.dir, name);
    const text = plan.read(path);
    if (text === null) continue;
    if (isUneditedManagedFile(text)) {
      plan.delete(path, "the Standard now uses Prettier's defaults");
    } else if (plan.isForced("prettier")) {
      plan.delete(
        path,
        "replaced by --force=prettier: the Standard uses Prettier's defaults",
      );
    } else {
      plan.note(
        `${plan.display(path)}: your own Prettier config is kept. The Standard uses Prettier's defaults; re-run with --force=prettier to delete it.`,
      );
    }
  }
}

export function prettierStep(plan: Plan): void {
  const { dir } = plan.project;
  removeConfigs(plan);

  const ignorePath = join(dir, ".prettierignore");
  if (
    reconcileManagedFile(plan, "prettier", ignorePath, stamp(IGNORE, "#")) ===
    "kept"
  ) {
    const current = plan.read(ignorePath) ?? "";
    if (!/^CHANGELOG\.md$/m.test(current)) {
      plan.warn(
        ".prettierignore does not ignore CHANGELOG.md; `format:check` will fail after a Release. Add it.",
      );
    }
  }

  plan.ensureDevDependency("prettier", THIRD_PARTY_RANGES.prettier);
  plan.setScript("prettier", "format", "prettier --write .");
  plan.setScript("prettier", "format:check", "prettier --check .");
}
