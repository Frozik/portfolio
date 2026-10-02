import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listBuildAssets } from './build-assets.ts';

describe('listBuildAssets', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'build-assets-'));
    mkdirSync(join(outDir, 'assets', 'nested'), { recursive: true });
    writeFileSync(join(outDir, 'index.html'), '');
    writeFileSync(join(outDir, 'assets', 'e-entry.js'), '');
    writeFileSync(join(outDir, 'assets', 'a-style.css'), '');
    writeFileSync(join(outDir, 'assets', 'nested', 'c-chunk.js'), '');
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('lists every file under assets as a URL relative to the build root, sorted', () => {
    expect(listBuildAssets(outDir)).toEqual([
      'assets/a-style.css',
      'assets/e-entry.js',
      'assets/nested/c-chunk.js',
    ]);
  });

  it('leaves the shell files outside assets to the precache manifest', () => {
    expect(listBuildAssets(outDir)).not.toContain('index.html');
  });
});
