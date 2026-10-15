import type { TResult } from '@frozik/utils/result/result';

import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TUnlock } from '@frozik/vault/format/open-vault';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import type { TSyncStop } from '@frozik/vault/sync/sync-state';
import type { TLockReason } from './lifecycle-state';

export type TCredential = Exclude<TUnlock, { readonly kind: 'session' }>;

/** What happened to the vault on this tab, in past tense. */
export type TLifecycleEvent =
  /**
   * `reason`: why the process before this one locked it, when a wipe left a note; `kept`: a quick
   * lock this platform kept across the restart still holds it.
   */
  | {
      readonly kind: 'vault-chosen';
      readonly vaultKey: TVaultKey;
      readonly reason: TLockReason | null;
      readonly kept: boolean;
    }
  | {
      readonly kind: 'create-requested';
      readonly name: string;
      readonly description: string;
      readonly password: TBytes;
    }
  | { readonly kind: 'created'; readonly result: TResult<TVaultKey, TUnlockFailure> }
  | { readonly kind: 'unlock-requested'; readonly credential: TCredential }
  | {
      readonly kind: 'opened';
      readonly result: TResult<'read-write' | 'read-only', TUnlockFailure>;
    }
  | { readonly kind: 'lock-requested'; readonly reason: TLockReason }
  | { readonly kind: 'draft-flushed' }
  | { readonly kind: 'sync-stopped'; readonly stop: TSyncStop }
  | { readonly kind: 'forgotten' }
  /** Quick unlock was set up or switched off while the vault is open. */
  | { readonly kind: 'quick-unlock-changed'; readonly ready: boolean }
  /** The one try at a quick lock: the code in its canonical form. */
  | { readonly kind: 'quick-unlock-requested'; readonly code: string }
  | { readonly kind: 'quick-expired' }
  /** The quick lock's effect finished: the key is behind the code, or it could not be kept. */
  | { readonly kind: 'quick-locked'; readonly held: boolean }
  /** The platform's biometric prompt, for a vault enrolled on this device. */
  | { readonly kind: 'device-unlock-requested' }
  /** The user closed a prompt: back to the unlock screen as it was, no failure. */
  | { readonly kind: 'unlock-cancelled' };
