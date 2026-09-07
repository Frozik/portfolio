#!/usr/bin/env node
// Conventions the linter cannot express, checked mechanically (see
// `source-conventions.ts`). Run from the repository root:
//
//   check-source-conventions [--update-baseline]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FileSizeBaseline } from './source-conventions.ts';
import { checkSourceConventions, MAX_LINES, nextBaseline } from './source-conventions.ts';

const BASELINE_PATH = 'libs/tooling/file-size-baseline.json';
const UPDATE_FLAG = '--update-baseline';
/** Every workspace package's sources — a new package is covered the day it appears. */
const WORKSPACE_DIRECTORIES = ['apps', 'libs'];

function sourceRoots(): string[] {
  return WORKSPACE_DIRECTORIES.flatMap(directory =>
    readdirSync(directory)
      .map(name => join(directory, name, 'src'))
      .filter(root => existsSync(root))
  );
}

function readBaseline(): FileSizeBaseline {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as FileSizeBaseline;
  } catch {
    return {};
  }
}

const report = checkSourceConventions({
  roots: sourceRoots(),
  baseline: readBaseline(),
  cwd: process.cwd(),
});

if (process.argv.includes(UPDATE_FLAG)) {
  const next = nextBaseline(report);
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`baseline written: ${Object.keys(next).length} oversized files`);
  process.exit(0);
}

if (report.shrunk.length > 0) {
  console.log(
    `${report.shrunk.length} baselined file(s) shrank — run with ${UPDATE_FLAG} to lock in the gain:`
  );
  for (const [file, allowed, current] of report.shrunk) {
    console.log(`  ${file}: ${allowed} → ${current ?? `≤ ${MAX_LINES}`}`);
  }
}

if (report.problems.length > 0) {
  console.error(report.problems.join('\n'));
  console.error(`\n${report.problems.length} convention violation(s)`);
  process.exit(1);
}
console.log('source conventions ok');
