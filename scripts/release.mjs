// Prepares one package's release on the current branch: bumps its version from the commits that
// touched its folder (Conventional Commits), writes its CHANGELOG.md and commits. No tag: after the
// PR is merged, the Release workflow (.github/workflows/publish.yml) tags and publishes it.
//
// Usage: pnpm release <package> <type>
//   package  eslint-config | eslint-config-legacy | init-react
//   type     patch | minor | major (full Release) or alpha | beta | rc (Prerelease)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const FULL = ["patch", "minor", "major"];
const PRE = ["alpha", "beta", "rc"];

const [name, type] = process.argv.slice(2);
const dir = `packages/${name}`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!name || !existsSync(`${dir}/package.json`)) {
  fail(`Usage: pnpm release <package> <type>; no package at ${dir}.`);
}
if (![...FULL, ...PRE].includes(type)) {
  fail(`Release type must be one of ${[...FULL, ...PRE].join(", ")}.`);
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) fail("Commit or stash your changes first.");
if (git("branch", "--show-current") === "main") {
  fail("Run this on a branch; the release reaches main through a PR.");
}

const manifest = `${dir}/package.json`;
const args = [
  "commit-and-tag-version",
  "--path",
  dir,
  "--tag-prefix",
  `${name}@`,
  "--packageFiles",
  manifest,
  "--bumpFiles",
  manifest,
  "--infile",
  `${dir}/CHANGELOG.md`,
  "--releaseCommitMessageFormat",
  `chore(release): ${name}@{{currentTag}}`,
  "--skip.tag",
  ...(FULL.includes(type)
    ? ["--release-as", type]
    : ["--prerelease", type, "--skip.changelog"]),
];
execFileSync("pnpm", ["exec", ...args], { stdio: "inherit" });
