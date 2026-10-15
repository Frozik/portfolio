import type { IHostFile } from '@frozik/vite-plugins/host-file';
import { readHostFile, requiredHostValue } from '@frozik/vite-plugins/host-file';

export type DeploymentTarget = {
  readonly communicationUrl: string;
  readonly googleClientId: string;
  readonly yandexClientId: string;
  readonly googleVaultClientId: string;
};

export function toDeploymentTarget(host: IHostFile): DeploymentTarget {
  return {
    communicationUrl: `https://${requiredHostValue(host, 'COMMUNICATION_DOMAIN')}`,
    googleClientId: requiredHostValue(host, 'GOOGLE_OAUTH_CLIENT_ID'),
    // Yandex is optional: without it the provider stays disabled in the UI.
    yandexClientId: host.values.YANDEX_OAUTH_CLIENT_ID ?? '',
    // Optional too: without it the vault offers no Google Drive.
    googleVaultClientId: host.values.GOOGLE_VAULT_CLIENT_ID ?? '',
  };
}

/**
 * The deployment facts the browser bundle needs, from the chosen host's file.
 * `VITE_COMMUNICATION_URL` in the environment still wins, so a local backend
 * is one variable away.
 */
export function readDeploymentTarget(repoRoot: string): DeploymentTarget {
  const target = toDeploymentTarget(readHostFile(repoRoot));
  const override = process.env.VITE_COMMUNICATION_URL;
  if (override !== undefined && override.length > 0) {
    return { ...target, communicationUrl: override };
  }
  return target;
}
