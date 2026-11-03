import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/** An error caused by the user's project or input; printed without a stack trace. */
export class UserError extends Error {}

export function readTextOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Normalises line endings and trailing whitespace so fingerprints survive editors and git autocrlf. */
export function normalize(text: string): string {
  return (
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim() + "\n"
  );
}

export function sha256(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

/** Runs a command and returns trimmed stdout, or null when it fails. */
export function capture(
  command: string,
  args: string[],
  cwd: string,
): string | null {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

/** Whether `command --version` runs, e.g. whether pnpm is installed. */
export function hasCommand(command: string, cwd: string): boolean {
  const result = spawnSync(command, ["--version"], {
    cwd,
    stdio: "ignore",
    // npm, pnpm and yarn are .cmd shims on Windows.
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

/** Runs a command with inherited output; returns its exit code. */
export function run(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {},
): number {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    // npm, pnpm and yarn are .cmd shims on Windows.
    shell: process.platform === "win32",
    ...options,
  });
  return result.status ?? 1;
}

// Loops rather than `/x+$/`: an unanchored regex like that backtracks on a long run of x.

/** Removes every `char` from the end of `text`. */
export function trimTrailing(text: string, char: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === char) end -= 1;
  return text.slice(0, end);
}

/** Removes every `char` from the start of `text`. */
export function trimLeading(text: string, char: string): string {
  let start = 0;
  while (start < text.length && text[start] === char) start += 1;
  return text.slice(start);
}

export function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}
