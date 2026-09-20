import { affectedProjectIds, isLockfileChange } from './affected.ts';

describe('affectedProjectIds', () => {
  it('drops the root project, which every change touches', () => {
    const json = JSON.stringify({ projects: [{ id: 'portfolio' }, { id: 'root' }] });
    expect(affectedProjectIds(json)).toEqual(['portfolio']);
  });

  it('reports nothing when only the root project matched', () => {
    expect(affectedProjectIds(JSON.stringify({ projects: [{ id: 'root' }] }))).toEqual([]);
  });

  it('reports nothing when the query matched no project at all', () => {
    expect(affectedProjectIds(JSON.stringify({}))).toEqual([]);
  });
});

describe('isLockfileChange', () => {
  it('treats a lockfile edit as touching everything', () => {
    expect(isLockfileChange(['apps/portfolio/src/main.tsx', 'pnpm-lock.yaml'])).toBe(true);
  });

  it('treats the workspace manifest the same way', () => {
    expect(isLockfileChange(['pnpm-workspace.yaml'])).toBe(true);
  });

  it('leaves ordinary source changes alone', () => {
    expect(isLockfileChange(['apps/communication/src/main.ts'])).toBe(false);
  });
});
