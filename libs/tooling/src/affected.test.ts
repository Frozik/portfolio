import { affectedProjectIds, everythingAffectedBy } from './affected.ts';

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

describe('everythingAffectedBy', () => {
  it('treats a lockfile edit as touching everything', () => {
    expect(everythingAffectedBy(['apps/portfolio/src/main.tsx', 'pnpm-lock.yaml'])).toBe(
      'lockfile'
    );
  });

  it('treats the workspace manifest the same way', () => {
    expect(everythingAffectedBy(['pnpm-workspace.yaml'])).toBe('lockfile');
  });

  it("runs every job when CI's runner or a shared step changes", () => {
    expect(everythingAffectedBy(['.github/workflows/ci.yml'])).toBe('ci-environment');
    expect(everythingAffectedBy(['.github/actions/android-build-env/action.yml'])).toBe(
      'ci-environment'
    );
  });

  it('leaves a release or deploy workflow to its own jobs', () => {
    expect(everythingAffectedBy(['.github/workflows/deploy-pages.yml'])).toBeNull();
  });

  it('leaves ordinary source changes alone', () => {
    expect(everythingAffectedBy(['apps/communication/src/main.ts'])).toBeNull();
  });
});
