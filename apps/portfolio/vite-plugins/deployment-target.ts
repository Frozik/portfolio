import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Which machine in `infra/hosts/` the bundle should talk to. */
const HOST_ENV = 'DEPLOY_HOST_NAME';
const DEFAULT_HOST = 'production';

export type DeploymentTarget = {
  readonly communicationUrl: string;
  readonly googleClientId: string;
  readonly yandexClientId: string;
};

/** `KEY=VALUE` lines, `#` comments, no quoting or interpolation. */
export function parseHostFile(contents: string): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return values;
}

export function toDeploymentTarget(
  values: Readonly<Record<string, string>>,
  hostName: string
): DeploymentTarget {
  const domain = values.COMMUNICATION_DOMAIN;
  if (domain === undefined || domain.length === 0) {
    throw new Error(`Host "${hostName}" declares no COMMUNICATION_DOMAIN`);
  }
  const googleClientId = values.GOOGLE_OAUTH_CLIENT_ID;
  if (googleClientId === undefined || googleClientId.length === 0) {
    throw new Error(`Host "${hostName}" declares no GOOGLE_OAUTH_CLIENT_ID`);
  }
  return {
    communicationUrl: `https://${domain}`,
    googleClientId,
    // Yandex is optional: without it the provider stays disabled in the UI.
    yandexClientId: values.YANDEX_OAUTH_CLIENT_ID ?? '',
  };
}

/**
 * The deployment facts the browser bundle needs, read from the same
 * `infra/hosts/<name>.env` the provisioning scripts use — one owner for the
 * signaling URL and the OAuth client ids, instead of a `.env` copy per app
 * that silently drifts when a client is rotated.
 *
 * `VITE_COMMUNICATION_URL` in the environment still wins, so a local backend
 * is one variable away.
 */
export function readDeploymentTarget(repoRoot: string): DeploymentTarget {
  const hostName = process.env[HOST_ENV] ?? DEFAULT_HOST;
  const path = resolve(repoRoot, 'infra', 'hosts', `${hostName}.env`);
  if (!existsSync(path)) {
    throw new Error(`Unknown deployment host "${hostName}": ${path} does not exist`);
  }
  const target = toDeploymentTarget(parseHostFile(readFileSync(path, 'utf8')), hostName);
  const override = process.env.VITE_COMMUNICATION_URL;
  if (override !== undefined && override.length > 0) {
    return { ...target, communicationUrl: override };
  }
  return target;
}
