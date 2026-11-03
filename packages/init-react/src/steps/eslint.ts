import { join } from "node:path";
import semver from "semver";
import {
  ESLINT_CONFIG,
  ESLINT_CONFIG_LEGACY,
  ESLINT_RANGES,
} from "../constants.js";
import {
  isScaffoldDefault,
  SCAFFOLD_LINT_DEPENDENCIES,
  SCAFFOLD_LINT_SCRIPTS,
} from "../fingerprints.js";
import { isUneditedManagedFile, stamp } from "../managed.js";
import { rangeSatisfies, type Plan } from "../plan.js";
import { configFileName, sharedPackageRange } from "./standard.js";

/** Which Standard a project gets: flat config (ESLint 9 and 10) or .eslintrc (ESLint 8). */
export type EslintVariant = "flat" | "legacy";

const FLAT_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];
const LEGACY_FILES = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

const FLAT_BODY = `import standard from "${ESLINT_CONFIG}";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...standard,
  // Project-specific rules go here: add a rule, change its level, or set it to "off".
]);
`;

const LEGACY_BODY = `{
  "root": true,
  "extends": ["${ESLINT_CONFIG_LEGACY}"],
  // Project-specific rules go here: add a rule, change its level, or set it to "off".
  "rules": {}
}
`;

/** ESLint 8 only lints .js files unless told otherwise. */
const LEGACY_LINT_SCRIPT = "eslint --ext .js,.jsx,.ts,.tsx .";

/** A range semver can't read (e.g. a dist-tag like "latest") is taken as the newest major. */
const FALLBACK_ESLINT_MAJOR = 10;

/**
 * The project's ESLint decides: one older than flat config gets the legacy Standard. A project
 * without ESLint gets the flat Standard, unless it already has an .eslintrc file.
 */
export function eslintVariant(plan: Plan): EslintVariant {
  const current = installedEslint(plan);
  if (current !== undefined) {
    return rangeSatisfies(current, ESLINT_RANGES.flat) ? "flat" : "legacy";
  }
  const { dir } = plan.project;
  return LEGACY_FILES.some((name) => plan.read(join(dir, name)) !== null)
    ? "legacy"
    : "flat";
}

export function eslintStep(plan: Plan): void {
  if (eslintVariant(plan) === "legacy") legacyStep(plan);
  else flatStep(plan);
}

function flatStep(plan: Plan): void {
  const { dir, esm } = plan.project;
  const { outcome, replacedScaffold } = plan.reconcileConfigFile({
    tool: "eslint",
    target: join(dir, configFileName("eslint.config", esm)),
    content: stamp(FLAT_BODY, "//"),
    candidates: [...FLAT_FILES, ...LEGACY_FILES].map((name) => join(dir, name)),
    pkgKey: "eslintConfig",
    snippet: `import standard from "${ESLINT_CONFIG}";\n// ...then spread \`...standard\` first in your exported config array`,
  });
  if (outcome === "kept") {
    plan.note(
      `ESLint: your own config is kept. To use the Standard, add ${ESLINT_CONFIG} to it as shown above, or re-run with --force=eslint to replace it (add your own rules back where it says "Project-specific rules go here").`,
    );
    return;
  }

  const eslint = installedEslint(plan) ?? ESLINT_RANGES.flatNew;
  plan.ensureDevDependency("eslint", eslint);
  // @eslint/js follows ESLint's own major, so the Standard leaves it to the project.
  plan.ensureDevDependency("@eslint/js", `^${majorOf(eslint)}.0.0`);
  plan.ensureDevDependency(ESLINT_CONFIG, sharedPackageRange(ESLINT_CONFIG));
  if (replacedScaffold) {
    // The Standard's package brings these; Vite's copies would only drift. @eslint/js stays:
    // the Standard needs the project's own, matching its ESLint.
    for (const name of SCAFFOLD_LINT_DEPENDENCIES.filter(
      (n) => n !== "@eslint/js",
    )) {
      plan.removeDevDependency(name, "now provided by the Standard");
    }
  }
  replaceOxlint(plan);
  plan.setScript("eslint", "lint", "eslint .", SCAFFOLD_LINT_SCRIPTS);
}

function legacyStep(plan: Plan): void {
  const { dir } = plan.project;
  const { outcome } = plan.reconcileConfigFile({
    tool: "eslint",
    target: join(dir, ".eslintrc.json"),
    content: stamp(LEGACY_BODY, "//"),
    candidates: LEGACY_FILES.map((name) => join(dir, name)),
    pkgKey: "eslintConfig",
    snippet: `Put "${ESLINT_CONFIG_LEGACY}" first in "extends", then remove the configs, plugins and rules it already provides`,
  });
  plan.note(
    `ESLint ${installedEslint(plan) ?? ESLINT_RANGES.legacy}: this project gets the legacy Standard (${ESLINT_CONFIG_LEGACY}, .eslintrc). To move to flat config, install eslint ${ESLINT_RANGES.flatNew} and re-run with --force=eslint.`,
  );
  if (outcome === "kept") return;

  removeFlatConfigs(plan);
  plan.ensureDevDependency("eslint", ESLINT_RANGES.legacy);
  plan.ensureDevDependency(
    ESLINT_CONFIG_LEGACY,
    sharedPackageRange(ESLINT_CONFIG_LEGACY),
  );
  // Vite's `lint` and the flat Standard's both run `eslint .`, which skips .ts files in ESLint 8.
  plan.setScript(
    "eslint",
    "lint",
    LEGACY_LINT_SCRIPT,
    new Set([...SCAFFOLD_LINT_SCRIPTS, "eslint ."]),
  );
}

/**
 * ESLint 8.57 prefers an eslint.config.* file over .eslintrc whenever one exists, so a flat
 * config left from Vite's scaffold or an earlier release would hide the legacy Standard.
 */
function removeFlatConfigs(plan: Plan): void {
  for (const name of FLAT_FILES) {
    const path = join(plan.project.dir, name);
    const text = plan.read(path);
    if (text === null) continue;
    if (isScaffoldDefault(name, text) || isUneditedManagedFile(text)) {
      plan.delete(path, "ESLint 8 would read it instead of .eslintrc.json");
    } else {
      plan.warn(
        `${plan.display(path)}: ESLint 8 reads this flat config instead of .eslintrc.json. Move its rules into .eslintrc.json and delete it, or upgrade ESLint and re-run with --force=eslint.`,
      );
    }
  }
}

function installedEslint(plan: Plan): string | undefined {
  return plan.pkg.devDependencies?.eslint ?? plan.pkg.dependencies?.eslint;
}

function majorOf(range: string): number {
  return semver.validRange(range)
    ? (semver.minVersion(range)?.major ?? FALLBACK_ESLINT_MAJOR)
    : FALLBACK_ESLINT_MAJOR;
}

/** Vite 9+ ships oxlint; the Standard uses ESLint, so an unedited oxlint setup is removed. */
function replaceOxlint(plan: Plan): void {
  const path = join(plan.project.dir, ".oxlintrc.json");
  const text = plan.read(path);
  if (text === null) return;
  if (isScaffoldDefault(".oxlintrc.json", text) || plan.isForced("eslint")) {
    plan.delete(path, "Vite's oxlint default; the Standard uses ESLint");
    plan.removeDevDependency("oxlint", "the Standard uses ESLint");
  } else {
    plan.log(
      "keep",
      ".oxlintrc.json: your own oxlint config. It is kept; `lint` now runs ESLint. Use --force=eslint to remove oxlint.",
    );
  }
}
