#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
// Which Moon projects a commit range touches, dependencies included.
//
//   affected-projects <base> [head]        prints one project id per line
//   affected-projects <base> [head] --is <id> [--is <id>…]   exits 0 when any <id> is affected, 1 otherwise
//
// Deploy workflows ask this instead of matching paths by hand: a change in
// `libs/utils` reaches both apps, a change in `libs/components` reaches only
// the portfolio, and the answer follows the real graph rather than a list
// that silently rots.

import { affectedProjectIds, isLockfileChange } from './affected.ts';

// moon lives in the workspace's node_modules, which is not on PATH when this
// bin is invoked directly rather than through `pnpm exec`.
const MOON_BIN = existsSync('node_modules/.bin/moon') ? 'node_modules/.bin/moon' : 'moon';

function moon(args: readonly string[], input?: string): string {
  return execFileSync(MOON_BIN, [...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function changedFiles(base: string, head: string): readonly string[] {
  const raw = moon(['query', 'changed-files', '--base', base, '--head', head]);
  return (JSON.parse(raw) as { readonly files?: readonly string[] }).files ?? [];
}

function affectedProjects(files: readonly string[]): readonly string[] {
  if (files.length === 0) {
    return [];
  }
  const raw = moon(['query', 'projects', '--affected', '--downstream', 'deep'], files.join('\n'));
  return affectedProjectIds(raw);
}

const [base, ...rest] = process.argv.slice(2);
if (base === undefined) {
  console.error('usage: affected-projects <base> [head] [--is <project-id>]...');
  process.exit(2);
}

const wanted = rest.flatMap((arg, index) => (rest[index - 1] === '--is' ? [arg] : []));
const head = rest[0] === undefined || rest[0] === '--is' ? 'HEAD' : rest[0];

const files = changedFiles(base, head);
// Moon attributes a lockfile change to the root project alone, but a
// dependency bump can change what any app ships — so it counts for everything.
const everything = isLockfileChange(files);
const projects = everything ? undefined : affectedProjects(files);

if (wanted.length === 0) {
  console.log(everything ? '<all: lockfile changed>' : projects?.join('\n'));
  process.exit(0);
}

const affected = everything || wanted.some(id => projects?.includes(id) ?? false);
const reason = everything
  ? 'a lockfile changed, so every project counts as affected'
  : `affected projects: ${projects?.join(', ') || 'none'}`;
console.log(`${wanted.join(' or ')}: ${affected ? 'affected' : 'not affected'} (${reason})`);
process.exit(affected ? 0 : 1);
