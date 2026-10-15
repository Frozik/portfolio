import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isNil } from 'lodash-es';

/** Which machine in `infra/hosts/` the bundle should talk to. */
const HOST_ENV = 'DEPLOY_HOST_NAME';
const DEFAULT_HOST = 'production';

export interface IHostFile {
  readonly name: string;
  readonly values: Readonly<Record<string, string>>;
}

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

/**
 * The chosen machine's `infra/hosts/<name>.env` — the file the provisioning
 * scripts read too, so an OAuth client id or an address has one owner instead
 * of a `.env` copy per app that silently drifts when a client is rotated.
 */
export function readHostFile(repoRoot: string): IHostFile {
  const name = process.env[HOST_ENV] ?? DEFAULT_HOST;
  const path = resolve(repoRoot, 'infra', 'hosts', `${name}.env`);
  if (!existsSync(path)) {
    throw new Error(`Unknown deployment host "${name}": ${path} does not exist`);
  }
  return { name, values: parseHostFile(readFileSync(path, 'utf8')) };
}

/** A value the bundle cannot work without. */
export function requiredHostValue(host: IHostFile, key: string): string {
  const value = host.values[key];
  if (isNil(value) || value.length === 0) {
    throw new Error(`Host "${host.name}" declares no ${key}`);
  }
  return value;
}
