#!/usr/bin/env node
// Conventions the linter cannot express, checked mechanically:
//   1. No separator comments (`// ── Title ──`, `// ----------`); split files instead.
//   2. Oversized files must not grow. Files longer than MAX_LINES are listed in
//      `.file-size-baseline.json` with their current length; a listed file may
//      only shrink, an unlisted file may not exceed MAX_LINES. Regenerate the
//      baseline after a genuine reduction with `--update-baseline`.
//
//   node scripts/check-source-conventions.mjs [--update-baseline]

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_LINES = 400;
const BASELINE_PATH = '.file-size-baseline.json';
const ROOTS = ['apps/portfolio/src', 'apps/communication/src', 'libs/utils/src', 'libs/components/src', 'libs/communication-protocol/src'];
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.tsx?$/;
const SEPARATOR_COMMENT = /^\s*\/\/\s*(?:[─═━\-=*#]{5,}|[─═━]+\s.*\s[─═━]+)\s*$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      yield path;
    }
  }
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const updateBaseline = process.argv.includes('--update-baseline');
const baseline = readBaseline();
const problems = [];
const oversized = {};

for (const root of ROOTS) {
  for (const path of walk(root)) {
    const file = relative(process.cwd(), path);
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
      problems.push(`${file}: ${length} lines — new files stay under ${MAX_LINES} lines (one responsibility per module)`);
    } else if (length > allowed) {
      problems.push(`${file}: grew from ${allowed} to ${length} lines — oversized files may only shrink`);
    }
  }
}

if (updateBaseline) {
  const next = Object.fromEntries(Object.entries(oversized).sort());
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`baseline written: ${Object.keys(next).length} oversized files`);
  process.exit(0);
}

const shrunk = Object.entries(baseline).filter(([file, allowed]) => (oversized[file] ?? 0) < allowed);
if (shrunk.length > 0) {
  console.log(`${shrunk.length} baselined file(s) shrank — run with --update-baseline to lock in the gain:`);
  for (const [file, allowed] of shrunk) {
    console.log(`  ${file}: ${allowed} → ${oversized[file] ?? '≤ ' + MAX_LINES}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} convention violation(s)`);
  process.exit(1);
}
console.log('source conventions ok');
