import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Longest a source file may be unless the baseline already lists it. */
export const MAX_LINES = 400;

/** File → line count of every file the baseline tolerates over {@link MAX_LINES}. */
export type FileSizeBaseline = Readonly<Record<string, number>>;

export interface SourceConventionsReport {
  /** Human-readable violations, one per line, in file order. */
  readonly problems: readonly string[];
  /** Every file over {@link MAX_LINES}, with its current length — the next baseline. */
  readonly oversized: Readonly<Record<string, number>>;
  /** Baselined files that got shorter: `[file, allowed, current]`. */
  readonly shrunk: readonly (readonly [string, number, number | undefined])[];
}

const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.tsx?$/;
/** `// ── Title ──`, `// ----------`, `// ==== ====`: a divider where a file split belongs. */
const SEPARATOR_COMMENT = /^\s*\/\/\s*(?:[─═━\-=*#]{5,}|[─═━]+\s.*\s[─═━]+)\s*$/;

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      yield path;
    }
  }
}

/**
 * The conventions the linter cannot express: no separator comments, and
 * oversized files may only shrink. A file over {@link MAX_LINES} must be in
 * the baseline with a length it has not exceeded; a file not listed may not
 * cross the limit at all.
 */
export function checkSourceConventions({
  roots,
  baseline,
  cwd,
}: {
  readonly roots: readonly string[];
  readonly baseline: FileSizeBaseline;
  readonly cwd: string;
}): SourceConventionsReport {
  const problems: string[] = [];
  const oversized: Record<string, number> = {};

  for (const root of roots) {
    for (const path of walk(join(cwd, root))) {
      const file = relative(cwd, path);
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (SEPARATOR_COMMENT.test(line)) {
          problems.push(`${file}:${index + 1}: separator comment — split the file instead`);
        }
      });
      const length = lines.length;
      if (length <= MAX_LINES) {
        continue;
      }
      oversized[file] = length;
      const allowed = baseline[file];
      if (allowed === undefined) {
        problems.push(
          `${file}: ${length} lines — new files stay under ${MAX_LINES} lines (one responsibility per module)`
        );
      } else if (length > allowed) {
        problems.push(
          `${file}: grew from ${allowed} to ${length} lines — oversized files may only shrink`
        );
      }
    }
  }

  const shrunk = Object.entries(baseline)
    .filter(([file, allowed]) => (oversized[file] ?? 0) < allowed)
    .map(([file, allowed]) => [file, allowed, oversized[file]] as const);

  return { problems, oversized, shrunk };
}

/** The baseline as it should be written after a genuine reduction: sorted, oversized files only. */
export function nextBaseline(report: SourceConventionsReport): FileSizeBaseline {
  return Object.fromEntries(Object.entries(report.oversized).sort());
}
