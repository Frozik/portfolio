import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import type { ISyncState, TSyncStop } from '@frozik/vault/sync/sync-state';
import { isNil } from 'lodash-es';

/** What the header says about the cloud. */
export type TCloudStatus =
  | { readonly kind: 'none' }
  /** WebDAV whose sealed secrets did not open: reconnect in the settings. */
  | { readonly kind: 'unreachable' }
  /** Another tab of this vault syncs; this one only writes the local copy. */
  | { readonly kind: 'other-tab' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced' }
  | { readonly kind: 'sign-in-needed' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'waiting'; readonly cause: TStorageError | { readonly kind: 'conflicts' } }
  | { readonly kind: 'stopped'; readonly reason: TSyncStop };

export function cloudStatusOf({
  linked,
  reachable,
  leader,
  sync,
}: {
  readonly linked: boolean;
  readonly reachable: boolean;
  readonly leader: boolean;
  readonly sync: ISyncState | null;
}): TCloudStatus {
  if (!linked) {
    return { kind: 'none' };
  }
  if (!reachable) {
    return { kind: 'unreachable' };
  }
  if (!leader || isNil(sync)) {
    return { kind: 'other-tab' };
  }
  const { phase } = sync;
  switch (phase.kind) {
    case 'idle':
      return sync.context.pending ? { kind: 'syncing' } : { kind: 'synced' };
    case 'waiting':
      if (phase.cause.kind === 'auth-required') {
        return { kind: 'sign-in-needed' };
      }
      return phase.cause.kind === 'offline'
        ? { kind: 'offline' }
        : { kind: 'waiting', cause: phase.cause };
    case 'stopped':
      return { kind: 'stopped', reason: phase.reason };
    default:
      return { kind: 'syncing' };
  }
}
