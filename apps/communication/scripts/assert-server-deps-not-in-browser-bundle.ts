// Asserts that no server-only dependency leaks into the portfolio browser
// bundle. Hoisting in the monorepo means a stray `import 'fastify'` from
// shared code would be silently bundled — this guard fails the build instead.
//
// Strategy:
// - Run after a portfolio build with bundle stats enabled (ANALYZE=true).
// - The portfolio uses `rollup-plugin-visualizer` which emits
//   `apps/portfolio/bundle-stats.html`. Plain HTML grep is the simplest and
//   most stable approach (the JSON/raw-data template would require a vite
//   config change).
// - If the stats file is missing, this script triggers the analyzed build
//   itself.
//
// Run: node --experimental-strip-types apps/communication/scripts/assert-server-deps-not-in-browser-bundle.ts

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `socket.io-parser` and `engine.io-client` are deliberately absent: the
// browser `socket.io-client` depends on both, so they belong in the bundle.
const FORBIDDEN_MODULES = [
  'fastify',
  'socket.io',
  'engine.io',
  'jose',
  'config',
  'toml',
  '@prometheus-io/client',
  '@fastify/rate-limit',
  'pino',
  'pino-pretty',
  'p-retry',
  'redis',
  '@redis/client',
  '@socket.io/redis-adapter',
] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const STATS_PATH = resolve(REPO_ROOT, 'apps', 'portfolio', 'bundle-stats.html');

function ensureStats(): void {
  if (existsSync(STATS_PATH)) {
    return;
  }
  process.stdout.write(`[assert-server-deps] bundle-stats.html missing — running analyzed build\n`);
  execSync('pnpm --filter @frozik/portfolio build', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ANALYZE: 'true' },
  });
  if (!existsSync(STATS_PATH)) {
    process.stderr.write(`[assert-server-deps] expected ${STATS_PATH} to exist after build\n`);
    process.exit(1);
  }
}

function patternFor(moduleName: string): RegExp {
  // Match either `node_modules/<name>/` (real bundle path) or
  // `"<name>/<file>"` (visualizer module label). Escape regex metacharacters.
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:node_modules\\/|["\\'\`(])${escaped}(?:\\/|["\\'\`)])`, 'i');
}

function findLeaks(haystack: string): string[] {
  return FORBIDDEN_MODULES.filter(moduleName => patternFor(moduleName).test(haystack));
}

function main(): void {
  ensureStats();
  const haystack = readFileSync(STATS_PATH, 'utf8');
  const leaks = findLeaks(haystack);
  if (leaks.length > 0) {
    process.stderr.write(
      `[assert-server-deps] FAIL — server-only modules found in browser bundle:\n`
    );
    for (const leak of leaks) {
      process.stderr.write(`  - ${leak}\n`);
    }
    process.stderr.write(
      `\nThese modules must remain server-side. Check shared imports in libs/* or apps/portfolio/src.\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `[assert-server-deps] OK — no server-only modules detected in ${STATS_PATH}\n`
  );
}

main();
