#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// The version the next release will get, computed the way semantic-release
// computes it — the same commit analyzer with the same rules from
// `semantic-release.json` — but without touching the network or needing push
// rights. CI stamps the build with it before the release job creates the tag.
//
//   predict-version [ref]   (default HEAD)
//
// Prints `vX.Y.Z` when the commits since the last release tag warrant a
// release, otherwise `git describe --tags` for the ref.
import type { CommitAnalyzerConfig } from '@semantic-release/commit-analyzer';
import { analyzeCommits } from '@semantic-release/commit-analyzer';

import type { ReleaseType } from './next-version.ts';
import { nextVersion, versionOfTag } from './next-version.ts';

const CONFIG_PATH = 'libs/tooling/semantic-release.json';
const ANALYZER_PLUGIN = '@semantic-release/commit-analyzer';
const TAG_GLOB = 'v*';
/** ASCII unit and record separators: no commit message contains them. */
const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';

interface SemanticReleaseConfig {
  readonly plugins: readonly (string | readonly [string, CommitAnalyzerConfig])[];
}

function git(...args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function analyzerConfig(): CommitAnalyzerConfig {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as SemanticReleaseConfig;
  const plugin = config.plugins.find(entry => Array.isArray(entry) && entry[0] === ANALYZER_PLUGIN);
  if (plugin === undefined || typeof plugin === 'string') {
    throw new Error(`predict-version: ${ANALYZER_PLUGIN} is not configured in ${CONFIG_PATH}`);
  }
  return plugin[1];
}

function lastReleaseTag(ref: string): string | undefined {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', TAG_GLOB, ref);
  } catch {
    return undefined;
  }
}

function commitsSince(tag: string, ref: string): { hash: string; message: string }[] {
  const log = git('log', `--format=%H${FIELD_SEPARATOR}%B${RECORD_SEPARATOR}`, `${tag}..${ref}`);
  return log
    .split(RECORD_SEPARATOR)
    .map(record => record.trim())
    .filter(record => record.length > 0)
    .map(record => {
      const [hash, message] = record.split(FIELD_SEPARATOR);
      return { hash, message };
    });
}

const ref = process.argv[2] ?? 'HEAD';
const tag = lastReleaseTag(ref);
let version: string | undefined;

if (tag !== undefined) {
  const releaseType = (await analyzeCommits(analyzerConfig(), {
    commits: commitsSince(tag, ref),
    cwd: process.cwd(),
    logger: { log: () => {} },
  })) as ReleaseType | null;
  const next = nextVersion(versionOfTag(tag), releaseType);
  version = next === undefined ? undefined : `v${next}`;
}

console.log(version ?? git('describe', '--tags', '--always', ref));
