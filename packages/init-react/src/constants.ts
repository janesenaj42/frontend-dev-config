import { readFileSync } from "node:fs";

export const SCOPE = "@janesenaj42";
/**
 * Where publish.yml publishes the Shared Config Packages. A Target Project can install them
 * from elsewhere (an on-prem mirror) with --registry, saved in its package.json.
 */
export const DEFAULT_REGISTRY = "https://npm.pkg.github.com";

export const CLI_PACKAGE = `${SCOPE}/init-react`;
/** The Standard for ESLint 9 and 10 (flat config). */
export const ESLINT_CONFIG = `${SCOPE}/eslint-config`;
/** The Standard for ESLint 8 (.eslintrc), for projects not yet on flat config. */
export const ESLINT_CONFIG_LEGACY = `${SCOPE}/eslint-config-legacy`;

/**
 * The Shared Config Package versions this CLI release installs. Each package has its own
 * version; a test checks these ranges match the packages in this repository.
 */
export const SHARED_PACKAGE_RANGES = {
  [ESLINT_CONFIG]: "^1.0.0",
  [ESLINT_CONFIG_LEGACY]: "^1.0.0",
} as const;

/** Tools the user can name in `--force` and `--skip`. */
export const TOOLS = ["eslint", "prettier", "typecheck", "release"] as const;
export type Tool = (typeof TOOLS)[number];

/** ESLint versions each Standard supports, and the one a project without ESLint gets. */
export const ESLINT_RANGES = {
  flat: "^9.22.0 || ^10.0.0",
  flatNew: "^10.0.0",
  legacy: "^8.57.0",
} as const;

/** Third-party packages installed into a Target Project, at the ranges this release was tested with. */
export const THIRD_PARTY_RANGES = {
  prettier: "^3.9.9",
} as const;

// src/constants.ts and dist/index.js both sit one level below package.json.
const ownPackageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

/** The version of this CLI. */
export const OWN_VERSION = ownPackageJson.version;
