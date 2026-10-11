import type { TVaultKey } from '../persistence/ports';

/** Why a vault locked; shown on the unlock screen. */
export type TLockReason =
  | 'manual'
  | 'idle'
  | 'hidden'
  | 'sleep'
  | 'pagehide'
  | 'bfcache'
  | 'other-tab'
  | 'route-left'
  | 'key-rotated'
  | 'rollback-security'
  | 'forgotten';

/** Why an unlock failed, each with its own message. */
export type TUnlockFailure =
  | 'wrong-password'
  | 'slot-tampered'
  | 'corrupted'
  | 'unsupported-format'
  | 'unavailable'
  | 'not-found';

/** The vault's lifecycle on this tab; synchronisation is a separate engine inside `unlocked`. */
export type TLifecycleState =
  | { readonly kind: 'no-vault' }
  | { readonly kind: 'creating' }
  | {
      readonly kind: 'locked';
      readonly vaultKey: TVaultKey;
      readonly reason: TLockReason | null;
      readonly failure: TUnlockFailure | null;
    }
  /** A lock that arrives while the key is derived is kept and applied when the vault opens. */
  | {
      readonly kind: 'unlocking';
      readonly vaultKey: TVaultKey;
      readonly pendingLock: TLockReason | null;
    }
  | { readonly kind: 'unlocked'; readonly vaultKey: TVaultKey }
  /** A newer document schema: view and copy, never write. */
  | { readonly kind: 'read-only'; readonly vaultKey: TVaultKey }
  | { readonly kind: 'locking'; readonly vaultKey: TVaultKey; readonly reason: TLockReason };
