import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import {
  capture,
  hasCommand,
  toPosix,
  trimLeading,
  trimTrailing,
  UserError,
} from "./util.js";

export type PackageManager = "npm" | "pnpm" | "yarn";

export interface PackageJson {
  name?: string;
  type?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/** The Target Project: the folder the CLI runs in. */
export interface Project {
  dir: string;
  pkg: PackageJson;
  pkgIndent: string;
  /** Absolute git root, or null when the project is not in a git repository. */
  gitRoot: string | null;
  /** The project's path relative to the git root, posix style; "." when it is the root. */
  relDir: string;
  /** A filesystem-safe name for this project, used in generated file names. */
  slug: string;
  pm: PackageManager;
  /** Exact package manager version from `packageManager`, when declared. */
  pmVersion: string | null;
  yarnBerry: boolean;
  /** Whether config files may use ESM syntax with a `.js` extension. */
  esm: boolean;
  /** Whether tsconfig.json uses project references (Vite does), so typecheck needs `tsc -b`. */
  tsProjectReferences: boolean;
}

export function detectProject(dir: string): Project {
  dir = realpathSync.native(dir);
  const { pkg, pkgRaw } = readPackageJson(dir);
  const tsconfigPath = join(dir, "tsconfig.json");
  assertSupported(pkg, tsconfigPath);

  const gitRootRaw = capture("git", ["rev-parse", "--show-toplevel"], dir);
  const gitRoot = gitRootRaw ? realpathSync.native(gitRootRaw) : null;
  const relDir = gitRoot ? toPosix(relative(gitRoot, dir)) || "." : ".";

  return {
    dir,
    pkg,
    pkgIndent: /^([ \t]+)"/m.exec(pkgRaw)?.[1] ?? "  ",
    gitRoot,
    relDir,
    slug: slugFor(relDir, pkg, dir),
    ...detectToolchain(dir, gitRoot, pkg),
    esm: pkg.type === "module",
    tsProjectReferences: existsSync(tsconfigPath)
      ? /"references"\s*:/.test(readFileSync(tsconfigPath, "utf8"))
      : false,
  };
}

function readPackageJson(dir: string): { pkg: PackageJson; pkgRaw: string } {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    throw new UserError(
      `No package.json in ${dir}. Run this inside a React project.`,
    );
  }
  const pkgRaw = readFileSync(pkgPath, "utf8");
  return { pkg: JSON.parse(pkgRaw) as PackageJson, pkgRaw };
}

/** Throws for a project the Standard doesn't cover: not React, Next.js, or no TypeScript. */
function assertSupported(pkg: PackageJson, tsconfigPath: string): void {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!allDeps.react) {
    throw new UserError(
      "This is not a React project (no `react` dependency in package.json).",
    );
  }
  if (allDeps.next) {
    throw new UserError(
      "Next.js projects are not supported: they need their own ESLint rules.",
    );
  }
  if (!existsSync(tsconfigPath) && !allDeps.typescript) {
    throw new UserError(
      "JavaScript-only projects are not supported. Add TypeScript (a tsconfig.json) first.",
    );
  }
}

function detectToolchain(
  dir: string,
  gitRoot: string | null,
  pkg: PackageJson,
): Pick<Project, "pm" | "pmVersion" | "yarnBerry"> {
  const { pm, lockDir } = detectPackageManager(dir, gitRoot, pkg);
  const pmVersion = pkg.packageManager?.split("@")[1]?.split("+")[0] ?? null;
  const yarnBerry =
    pm === "yarn" &&
    (existsSync(join(lockDir, ".yarnrc.yml")) ||
      (pmVersion !== null && !pmVersion.startsWith("1.")));
  return { pm, pmVersion, yarnBerry };
}

function detectPackageManager(
  dir: string,
  gitRoot: string | null,
  pkg: PackageJson,
): { pm: PackageManager; lockDir: string } {
  // Walk up to the git root: in a workspace the lockfile sits at the workspace root.
  for (let current = dir; ; current = dirname(current)) {
    if (
      existsSync(join(current, "bun.lock")) ||
      existsSync(join(current, "bun.lockb"))
    ) {
      throw new UserError("Bun is not supported yet. Use npm, pnpm or yarn.");
    }
    if (existsSync(join(current, "pnpm-lock.yaml")))
      return { pm: "pnpm", lockDir: current };
    if (existsSync(join(current, "yarn.lock")))
      return { pm: "yarn", lockDir: current };
    if (existsSync(join(current, "package-lock.json")))
      return { pm: "npm", lockDir: current };
    if (current === gitRoot || dirname(current) === current) break;
  }
  const declared = pkg.packageManager?.split("@")[0];
  if (declared === "pnpm" || declared === "yarn" || declared === "npm") {
    return { pm: declared, lockDir: dir };
  }
  // A new project: the org prefers pnpm, and npm ships with Node.
  return { pm: hasCommand("pnpm", dir) ? "pnpm" : "npm", lockDir: dir };
}

function slugFor(relDir: string, pkg: PackageJson, dir: string): string {
  const raw =
    relDir === "."
      ? (pkg.name?.replace(/^@[^/]+\//, "") ?? basename(dir))
      : relDir;
  const slug = raw.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return trimLeading(trimTrailing(slug, "-"), "-") || "app";
}
