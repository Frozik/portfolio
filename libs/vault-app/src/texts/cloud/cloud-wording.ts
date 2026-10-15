import type { TWebDavProbeFailure } from '@frozik/cloud-storage/webdav/webdav-probe';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TVaultTexts } from '../vault/vault-texts';
import type { TCloudTexts } from './cloud-texts';

import type { TAdoptFailure } from '../../cloud/application/cloud-adoption';
import type { TCloudStatus } from '../../cloud/application/cloud-status';
import type { TDriveConnectFailure } from '../../cloud/application/GoogleDriveConnectForm';

export function webDavFailureText(t: TCloudTexts, failure: TWebDavProbeFailure): string {
  const { failures } = t.webdav;
  return failure.kind === 'server' ? failures.server(failure.status) : failures[failure.kind];
}

export function adoptFailureText(t: TCloudTexts, failure: TAdoptFailure): string {
  switch (failure.kind) {
    case 'storage':
      return webDavFailureText(t, failure.error);
    case 'not-found':
      return t.opening.notFound;
    case 'not-a-vault':
      return t.opening.notAVault;
    case 'device':
      return t.opening.device;
    default:
      return assertNever(failure);
  }
}

export function driveConnectFailureText(t: TCloudTexts, failure: TDriveConnectFailure): string {
  return failure.kind === 'auth'
    ? t.drive.authFailures[failure.reason]
    : webDavFailureText(t, failure.error);
}

export function cloudStatusText(
  texts: { readonly cloud: TCloudTexts; readonly vault: TVaultTexts },
  status: Exclude<TCloudStatus, { readonly kind: 'none' }>
): string {
  const t = texts.cloud.status;
  switch (status.kind) {
    case 'unreachable':
      return t.unreachable;
    case 'other-tab':
      return t.otherTab;
    case 'syncing':
      return t.syncing;
    case 'synced':
      return t.synced;
    case 'sign-in-needed':
      return t.signInNeeded;
    case 'offline':
      return t.offline;
    case 'waiting':
      return status.cause.kind === 'quota' ? t.quota : t.retrying;
    case 'stopped':
      return texts.vault.status.stopped[status.reason.kind];
    default:
      return assertNever(status);
  }
}
