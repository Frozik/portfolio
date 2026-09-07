declare module '@semantic-release/commit-analyzer' {
  export type ReleaseType =
    | 'major'
    | 'minor'
    | 'patch'
    | 'prerelease'
    | 'prepatch'
    | 'preminor'
    | 'premajor';

  export interface CommitAnalyzerConfig {
    readonly preset?: string;
    readonly releaseRules?: readonly Readonly<Record<string, unknown>>[];
  }

  export interface AnalyzedCommit {
    readonly hash: string;
    readonly message: string;
  }

  export interface CommitAnalyzerContext {
    readonly commits: readonly AnalyzedCommit[];
    readonly cwd: string;
    readonly logger: { readonly log: (...args: unknown[]) => void };
  }

  export function analyzeCommits(
    pluginConfig: CommitAnalyzerConfig,
    context: CommitAnalyzerContext
  ): Promise<ReleaseType | null>;
}
