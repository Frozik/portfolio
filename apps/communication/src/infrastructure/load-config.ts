import type { IServerConfig } from '../application/config/server-config-schema';
import { ServerConfigSchema } from '../application/config/server-config-schema';

// Issue surface for ConfigValidationError. Keep it primitive-only so it
// remains JSON-serializable for log shipping.
export type ConfigValidationIssue = {
  path: string;
  message: string;
  source?: string;
};

export class ConfigValidationError extends Error {
  public readonly issues: ReadonlyArray<ConfigValidationIssue>;

  constructor(issues: ReadonlyArray<ConfigValidationIssue>) {
    const formatted = issues
      .map(issue => {
        const sourceSuffix = issue.source ? ` (from ${issue.source})` : '';
        return `  ${issue.path}: ${issue.message}${sourceSuffix}`;
      })
      .join('\n');
    super(`Server config validation failed:\n${formatted}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

// Subset of the node-config util surface we actually use. Modeled as a type
// instead of pulling in the runtime package's untyped module, so we can
// validate against the contract.
type NodeConfigUtil = {
  toObject: () => unknown;
  getConfigSources: () => Array<{
    name: string;
    original?: unknown;
    parsed: unknown;
  }>;
};

type NodeConfigShape = {
  util: NodeConfigUtil;
};

const NODE_ENV_PRODUCTION = 'production';
const NODE_CONFIG_ENV_DEVELOPMENT = 'development';
const CORS_WILDCARD = '*';

// Walk the merged config sources from last (highest-priority) to first and
// return the first source that contains a value at `path`. Best-effort —
// returns undefined if it cannot determine the source.
function findSourceLayer(
  sources: ReadonlyArray<{ name: string; parsed: unknown }>,
  path: ReadonlyArray<PropertyKey>
): string | undefined {
  for (let index = sources.length - 1; index >= 0; index -= 1) {
    const source = sources[index];
    if (sourceHasPath(source.parsed, path)) {
      return source.name;
    }
  }
  return undefined;
}

function sourceHasPath(parsed: unknown, path: ReadonlyArray<PropertyKey>): boolean {
  let cursor: unknown = parsed;
  for (const segment of path) {
    if (cursor === null || typeof cursor !== 'object') {
      return false;
    }
    if (!Object.hasOwn(cursor, segment as string)) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[segment as string];
  }
  return cursor !== undefined;
}

function applyProductionRefinements(parsed: IServerConfig): ReadonlyArray<ConfigValidationIssue> {
  const issues: ConfigValidationIssue[] = [];

  if (parsed.server.cors_allowed_origins.length === 0) {
    issues.push({
      path: 'server.cors_allowed_origins',
      message: 'must be non-empty in production',
    });
  } else if (
    parsed.server.cors_allowed_origins.length === 1 &&
    parsed.server.cors_allowed_origins[0] === CORS_WILDCARD
  ) {
    issues.push({
      path: 'server.cors_allowed_origins',
      message: 'wildcard "*" is rejected in production',
    });
  }

  if (parsed.auth.google_oauth_client_id === '') {
    issues.push({
      path: 'auth.google_oauth_client_id',
      message: 'required in production (set via env GOOGLE_OAUTH_CLIENT_ID)',
    });
  }

  if (parsed.turn.enabled && parsed.turn.shared_secret === '') {
    issues.push({
      path: 'turn.shared_secret',
      message: 'required when turn.enabled; set via env TURN_SHARED_SECRET',
    });
  }

  return issues;
}

// Validate a raw config object against the schema and apply production
// cross-section refinements. Used by both the live `loadConfig` and tests.
export function loadConfigFromObject(
  raw: unknown,
  options: { isProduction?: boolean } = {}
): IServerConfig {
  const parsed = ServerConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ConfigValidationError(issues);
  }

  if (options.isProduction === true) {
    const refinementIssues = applyProductionRefinements(parsed.data);
    if (refinementIssues.length > 0) {
      throw new ConfigValidationError(refinementIssues);
    }
  }

  return parsed.data;
}

// Live config loader. The ONLY place in the codebase that reads from
// `node-config`. Triggers M2 / M8 / M21 cross-section validation.
// `node-config` scans `NODE_CONFIG_DIR` (or `./config`) the moment it is
// imported, so it is loaded here rather than at module top — importing this
// module for `loadConfigFromObject` (tests, tooling) must stay side-effect free.
export async function loadConfig(): Promise<IServerConfig> {
  const nodeConfigEnv = process.env.NODE_CONFIG_ENV;
  const nodeEnv = process.env.NODE_ENV;

  // M2: refuse to mix development config with production NODE_ENV.
  if (nodeConfigEnv === NODE_CONFIG_ENV_DEVELOPMENT && nodeEnv === NODE_ENV_PRODUCTION) {
    throw new ConfigValidationError([
      {
        path: '__env__',
        message:
          'refusing to start: NODE_CONFIG_ENV=development incompatible with NODE_ENV=production',
      },
    ]);
  }

  const { default: config } = await import('config');
  const nodeConfig = config as unknown as NodeConfigShape;
  const raw = nodeConfig.util.toObject();

  const parsed = ServerConfigSchema.safeParse(raw);
  if (!parsed.success) {
    // M21: surface which source layer last wrote each failing key.
    const sources = nodeConfig.util.getConfigSources();
    const issues = parsed.error.issues.map(issue => {
      const path = issue.path.join('.');
      const source = findSourceLayer(sources, issue.path);
      return { path, message: issue.message, source };
    });
    throw new ConfigValidationError(issues);
  }

  const isProduction = nodeConfigEnv === NODE_ENV_PRODUCTION || nodeEnv === NODE_ENV_PRODUCTION;
  if (isProduction) {
    const refinementIssues = applyProductionRefinements(parsed.data);
    if (refinementIssues.length > 0) {
      throw new ConfigValidationError(refinementIssues);
    }
  }

  return parsed.data;
}
