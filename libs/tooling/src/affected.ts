/** Moon reports the root project for nearly every change, so it carries no signal. */
const ROOT_PROJECT_ID = 'root';

const LOCKFILE_PATHS = ['pnpm-lock.yaml', 'pnpm-workspace.yaml'];
/** What every CI job runs on: its runner image, toolchains and shared steps. */
const CI_ENVIRONMENT_PATHS = ['.github/workflows/ci.yml'];
const CI_ENVIRONMENT_FOLDER = '.github/actions/';

/** Project ids from `moon query projects --json`, minus the always-present root. */
export function affectedProjectIds(queryJson: string): readonly string[] {
  const parsed = JSON.parse(queryJson) as {
    readonly projects?: readonly { readonly id: string }[];
  };
  return (parsed.projects ?? []).map(project => project.id).filter(id => id !== ROOT_PROJECT_ID);
}

/** Why a range counts as affecting every project, or `null` when it does not. */
export type TEverythingReason = 'lockfile' | 'ci-environment';

/**
 * Whether the range touches what every project depends on without Moon knowing.
 * Moon attributes the lockfiles to the root project only, yet a dependency bump
 * can change what any app ships. A change to CI's own environment — a runner
 * image, a shared step — can break any job, so every job has to run on it.
 */
export function everythingAffectedBy(files: readonly string[]): TEverythingReason | null {
  if (files.some(file => LOCKFILE_PATHS.includes(file))) {
    return 'lockfile';
  }
  return files.some(
    file => CI_ENVIRONMENT_PATHS.includes(file) || file.startsWith(CI_ENVIRONMENT_FOLDER)
  )
    ? 'ci-environment'
    : null;
}
