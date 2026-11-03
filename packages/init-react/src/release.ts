import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { detectProject, type Project } from "./project.js";
import {
  FULL_RELEASES,
  PRERELEASES,
  type ReleaseSettings,
} from "./steps/release.js";
import { capture, run, UserError } from "./util.js";

/**
 * A Release: bump the version, update the changelog (full releases only), commit
 * and tag. It never pushes, publishes or deploys.
 */
export function release(type: string, cwd: string): number {
  const isFull = assertReleaseType(type);
  const project = detectProject(cwd);
  if (!project.gitRoot) throw new UserError("Not a git repository.");

  const settings = project.pkg["init-react"] as
    Partial<ReleaseSettings> | undefined;
  const releaseBranch = settings?.releaseBranch ?? "main";
  const tagPrefix = settings?.tagPrefix ?? "v";

  const branch = assertReadyToRelease(project, isFull, releaseBranch);
  const args = releaseArgs(type, isFull, tagPrefix, project.relDir);
  const code = run(process.execPath, [commitAndTagVersionBin(), ...args], {
    cwd: project.dir,
    shell: false,
  });
  if (code === 0) {
    console.log(
      `\nReleased locally. Push it when ready:\n  git push --follow-tags origin ${branch}`,
    );
  }
  return code;
}

/** Throws for an unknown release type; returns whether it is a full Release. */
function assertReleaseType(type: string): boolean {
  const isFull = (FULL_RELEASES as readonly string[]).includes(type);
  const isPre = (PRERELEASES as readonly string[]).includes(type);
  if (!isFull && !isPre) {
    throw new UserError(
      `Unknown release type "${type}". Use one of: ${[...FULL_RELEASES, ...PRERELEASES].join(", ")}.`,
    );
  }
  return isFull;
}

/** Throws unless the working tree may be released; returns the current branch. */
function assertReadyToRelease(
  project: Project,
  isFull: boolean,
  releaseBranch: string,
): string | null {
  const branch = capture(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    project.dir,
  );
  if (isFull && branch !== releaseBranch) {
    throw new UserError(
      `Full releases only happen on the Release Branch "${releaseBranch}", and you are on "${branch}".\n` +
        `On this branch, make a Prerelease instead: release:rc (ready to ship), release:beta (feature-complete) or release:alpha (still being built).`,
    );
  }
  const dirty = capture("git", ["status", "--porcelain"], project.dir);
  if (dirty) {
    throw new UserError(
      "You have uncommitted changes. Commit or stash them before releasing.",
    );
  }
  return branch;
}

function releaseArgs(
  type: string,
  isFull: boolean,
  tagPrefix: string,
  relDir: string,
): string[] {
  return [
    ...(isFull
      ? ["--release-as", type]
      : // Prereleases bump and tag only: the changelog records what shipped.
        ["--prerelease", type, "--skip.changelog"]),
    "--tag-prefix",
    tagPrefix,
    "--releaseCommitMessageFormat",
    `chore(release): ${tagPrefix}{{currentTag}}`,
    // Only this project's commits count towards its Release.
    ...(relDir === "." ? [] : ["--path", "."]),
  ];
}

function commitAndTagVersionBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("commit-and-tag-version/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    bin: string | Record<string, string>;
  };
  const bin =
    typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin)[0]!;
  return join(dirname(pkgPath), bin);
}
