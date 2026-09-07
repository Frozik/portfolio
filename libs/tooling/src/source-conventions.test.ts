import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkSourceConventions, MAX_LINES, nextBaseline } from './source-conventions.ts';

let cwd: string;

function writeSource(file: string, lines: readonly string[]): void {
  mkdirSync(join(cwd, 'src'), { recursive: true });
  writeFileSync(join(cwd, 'src', file), lines.join('\n'));
}

const linesOf = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `const a${i} = ${i};`);

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'conventions-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('checkSourceConventions', () => {
  it('reports a separator comment with its line, and ignores tests', () => {
    writeSource('a.ts', ['const x = 1;', '// ────── Section ──────', 'const y = 2;']);
    writeSource('a.test.ts', ['// ----------']);

    const { problems } = checkSourceConventions({ roots: ['src'], baseline: {}, cwd });

    expect(problems).toEqual(['src/a.ts:2: separator comment — split the file instead']);
  });

  it('rejects an oversized file the baseline does not know', () => {
    writeSource('big.ts', linesOf(MAX_LINES + 1));

    const { problems, oversized } = checkSourceConventions({ roots: ['src'], baseline: {}, cwd });

    expect(problems[0]).toMatch(/^src\/big\.ts: 401 lines — new files stay under 400 lines/);
    expect(oversized).toEqual({ 'src/big.ts': MAX_LINES + 1 });
  });

  it('lets a baselined file stay, flags it when it grows, and notices when it shrinks', () => {
    writeSource('big.ts', linesOf(450));

    const staying = checkSourceConventions({
      roots: ['src'],
      baseline: { 'src/big.ts': 450 },
      cwd,
    });
    const grown = checkSourceConventions({ roots: ['src'], baseline: { 'src/big.ts': 440 }, cwd });
    const shrunk = checkSourceConventions({ roots: ['src'], baseline: { 'src/big.ts': 460 }, cwd });

    expect(staying.problems).toEqual([]);
    expect(grown.problems).toEqual([
      'src/big.ts: grew from 440 to 450 lines — oversized files may only shrink',
    ]);
    expect(shrunk.shrunk).toEqual([['src/big.ts', 460, 450]]);
  });

  it('writes the next baseline sorted, with oversized files only', () => {
    writeSource('z.ts', linesOf(410));
    writeSource('a.ts', linesOf(420));
    writeSource('small.ts', linesOf(10));

    const report = checkSourceConventions({ roots: ['src'], baseline: {}, cwd });

    expect(Object.keys(nextBaseline(report))).toEqual(['src/a.ts', 'src/z.ts']);
  });
});
