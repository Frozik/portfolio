import type { TResult } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import type { TUnlock } from '../format/open-vault';
import type { TVaultKey } from '../persistence/ports';
import type { TSyncStop } from '../sync/sync-state';
import type { TLockReason, TUnlockFailure } from './lifecycle-state';

export type TCredential = Exclude<TUnlock, { readonly kind: 'session' }>;

/** What happened to the vault on this tab, in past tense. */
export type TLifecycleEvent =
  | { readonly kind: 'vault-chosen'; readonly vaultKey: TVaultKey }
  | { readonly kind: 'create-requested'; readonly name: string; readonly password: TBytes }
  | { readonly kind: 'created'; readonly result: TResult<TVaultKey, TUnlockFailure> }
  | { readonly kind: 'unlock-requested'; readonly credential: TCredential }
  | {
      readonly kind: 'opened';
      readonly result: TResult<'read-write' | 'read-only', TUnlockFailure>;
    }
  | { readonly kind: 'lock-requested'; readonly reason: TLockReason }
  | { readonly kind: 'draft-flushed' }
  | { readonly kind: 'sync-stopped'; readonly stop: TSyncStop }
  | { readonly kind: 'forgotten' };
