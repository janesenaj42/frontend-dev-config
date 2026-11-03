import { CLI_PACKAGE } from "./constants.js";
import { normalize, sha256 } from "./util.js";

/**
 * A Managed File starts with a stamp line holding a hash of the rest of the file.
 * If the hash still matches, nobody has edited the file and a later run may update it.
 * Once someone edits it, the hash stops matching and it becomes Existing Config.
 */
const HASH_LENGTH = 16;
const STAMP = /^(?:\/\/|#) Managed by .+ \(hash:([0-9a-f]{16})\)\..*$/;

export type CommentPrefix = "//" | "#";

export function stamp(body: string, comment: CommentPrefix): string {
  const hash = sha256(body).slice(0, HASH_LENGTH);
  return (
    `${comment} Managed by ${CLI_PACKAGE} (hash:${hash}). Editing this file makes it yours; it will then never be updated automatically.\n` +
    normalize(body)
  );
}

export function isUneditedManagedFile(content: string): boolean {
  const normalized = normalize(content);
  const newline = normalized.indexOf("\n");
  const match = STAMP.exec(normalized.slice(0, newline));
  if (!match) return false;
  return (
    sha256(normalized.slice(newline + 1)).slice(0, HASH_LENGTH) === match[1]
  );
}

// A Managed Block is our section inside a file other people also write to (git hooks,
// a Target Project's README or CONTRIBUTING.md). The markers leave out the scope so blocks survive a move
// to another scope.
export interface BlockMarkers {
  start: string;
  end: string;
  /** Blank lines inside the markers, as Prettier writes Markdown around an HTML comment. */
  padded?: boolean;
}

/** Shell scripts (git hooks): `#` is a comment. */
export const SHELL_BLOCK: BlockMarkers = {
  start: "# >>> init-react >>>",
  end: "# <<< init-react <<<",
};

/** Markdown (README, CONTRIBUTING.md): an HTML comment so the markers don't render as text. */
export const MARKDOWN_BLOCK: BlockMarkers = {
  start: "<!-- >>> init-react >>> -->",
  end: "<!-- <<< init-react <<< -->",
  padded: true,
};

export function readBlock(
  content: string | null,
  markers: BlockMarkers = SHELL_BLOCK,
): string | null {
  if (content === null) return null;
  const start = content.indexOf(markers.start);
  const end = content.indexOf(markers.end);
  if (start === -1 || end === -1 || end < start) return null;
  return content.slice(start, end + markers.end.length);
}

/** Replaces our block in `content`, or appends it; everything outside the block is untouched. */
export function upsertBlock(
  content: string | null,
  blockBody: string,
  markers: BlockMarkers = SHELL_BLOCK,
): string {
  const gap = markers.padded ? "\n\n" : "\n";
  const block = `${markers.start}${gap}${blockBody.trim()}${gap}${markers.end}`;
  const existing = readBlock(content, markers);
  if (content === null || content.trim() === "") return block + "\n";
  // A replacer function, because the block holds shell `$1`, which string replace would expand.
  if (existing !== null) return content.replace(existing, () => block);
  return content.trimEnd() + "\n\n" + block + "\n";
}

/** Removes our block from `content`, with the blank lines around it; null if there is none. */
export function removeBlock(
  content: string | null,
  markers: BlockMarkers = SHELL_BLOCK,
): string | null {
  const existing = readBlock(content, markers);
  if (content === null || existing === null) return null;
  const start = content.indexOf(existing);
  const before = content.slice(0, start);
  const rest = content.slice(start + existing.length).trim();
  return before.trimEnd() + (rest === "" ? "\n" : "\n\n" + rest + "\n");
}
