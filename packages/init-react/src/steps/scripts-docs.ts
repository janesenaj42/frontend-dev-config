import { join } from "node:path";
import { CLI_PACKAGE } from "../constants.js";
import { MARKDOWN_BLOCK, removeBlock, upsertBlock } from "../managed.js";
import type { Plan } from "../plan.js";
import { runScript } from "./standard.js";

/** Prettier never writes a delimiter row shorter than `---`. */
const MIN_COLUMN_WIDTH = 3;

/**
 * Script names the Standard puts in package.json, in the order they should be
 * documented. Whichever of these actually end up in package.json (ours, or an
 * Existing Config script kept under the same name) get a row.
 */
const SCRIPT_DOCS: { names: string[]; what: string }[] = [
  { names: ["lint"], what: "Lint with ESLint" },
  { names: ["format"], what: "Format with Prettier" },
  { names: ["format:check"], what: "Check formatting without changing files" },
  { names: ["typecheck"], what: "Type-check with tsc" },
  {
    names: ["release:patch", "release:minor", "release:major"],
    what: "Full Release: bump, changelog, commit, tag",
  },
  {
    names: ["release:alpha", "release:beta", "release:rc"],
    what: "Prerelease: bump and tag only",
  },
];

/**
 * Script docs are for people who change the code. Where the Target Project has a
 * CONTRIBUTING.md (a README template may put them there), they go in it; otherwise in
 * the README. Either file is the user's own document, so the Standard never rewrites it
 * wholesale: it only keeps one Managed Block current, documenting whichever of its scripts
 * made it into package.json (including a script the user kept under the same name).
 */
export function scriptsDocsStep(plan: Plan): void {
  const { dir } = plan.project;
  // plan.pkg, not plan.project.pkg: the latter is the untouched original, and this
  // step must document the scripts every earlier step just decided on.
  const scripts = plan.pkg.scripts ?? {};
  const rows = SCRIPT_DOCS.filter((doc) =>
    doc.names.some((name) => scripts[name] !== undefined),
  ).map((doc) => [
    `\`${doc.names.map((name) => runScript(plan.project, name)).join("` / `")}\``,
    doc.what,
  ]);
  if (rows.length === 0) return;

  const block = `## Scripts

Added by [${CLI_PACKAGE}](https://github.com/janesenaj42/frontend-dev-config). Edits inside this block are overwritten the next time it runs; write anything else about the project around it.

${markdownTable(["Script", "What it does"], rows)}`;

  const readme = join(dir, "README.md");
  const contributing = join(dir, "CONTRIBUTING.md");
  const hasContributing = plan.read(contributing) !== null;
  const path = hasContributing ? contributing : readme;
  const current = plan.read(path);
  const next = upsertBlock(current, block, MARKDOWN_BLOCK);
  if (current !== next)
    plan.write(path, next, current === null ? "new file" : undefined);
  // One copy: a block a README got before the project had a CONTRIBUTING.md goes.
  if (hasContributing) removeBlockFrom(plan, readme);
}

function removeBlockFrom(plan: Plan, path: string): void {
  const next = removeBlock(plan.read(path), MARKDOWN_BLOCK);
  if (next !== null) plan.write(path, next);
}

/** A Markdown table with padded columns, as Prettier formats it, so `format:check` passes. */
export function markdownTable(header: string[], rows: string[][]): string {
  const widths = header.map((title, column) =>
    Math.max(
      title.length,
      MIN_COLUMN_WIDTH,
      ...rows.map((row) => row[column]!.length),
    ),
  );
  const line = (cells: string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column]!)).join(" | ")} |`;
  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ].join("\n");
}
