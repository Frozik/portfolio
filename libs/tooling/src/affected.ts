/** Moon reports the root project for nearly every change, so it carries no signal. */
const ROOT_PROJECT_ID = 'root';

const LOCKFILE_PATHS = ['pnpm-lock.yaml', 'pnpm-workspace.yaml'];

/** Project ids from `moon query projects --json`, minus the always-present root. */
export function affectedProjectIds(queryJson: string): readonly string[] {
  const parsed = JSON.parse(queryJson) as {
    readonly projects?: readonly { readonly id: string }[];
  };
  return (parsed.projects ?? []).map(project => project.id).filter(id => id !== ROOT_PROJECT_ID);
}

/**
 * Whether the range touches the lockfiles. Moon attributes those to the root
 * project only, yet a dependency bump can change what any app ships, so they
 * have to count as affecting everything.
 */
export function isLockfileChange(files: readonly string[]): boolean {
  return files.some(file => LOCKFILE_PATHS.includes(file));
}
