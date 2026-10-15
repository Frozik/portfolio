import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';

/** Why a vault locked; shown on the unlock screen. */
export const LOCK_REASONS = [
  /** The lock button: quick once quick unlock is ready, as password managers lock. */
  'manual',
  /** "Lock completely", and the app's own locks that must leave no key behind (a new key). */
  'complete',
  'idle',
  /** The app was out of sight (a hidden tab, an app in the background) for too long. */
  'concealed',
  'sleep',
  /** The app is going away (a page unloading). */
  'unloading',
  /** The app came back from a suspension that kept its memory (the back/forward cache). */
  'resumed',
  /** Another client of this device locked: one user, one session. */
  'other-client',
  /** The user left the vault for another part of the app. */
  'left',
  'rollback-security',
  'forgotten',
  /** This build is below the security floor: it must update before the vault opens again. */
  'update-required',
  /** The one try at a quick lock's code failed. */
  'quick-unlock-failed',
  /** A quick lock outlived its lifetime. */
  'quick-expired',
] as const;

export type TLockReason = (typeof LOCK_REASONS)[number];

export function isLockReason(value: string): value is TLockReason {
  return LOCK_REASONS.some(reason => reason === value);
}

/**
 * `quick` keeps the key behind a short code for one try and never survives
 * the process; `full` keeps nothing — only a credential opens the vault.
 */
export type TLockLevel = 'quick' | 'full';

/** The vault's lifecycle on this tab; synchronisation is a separate engine inside `unlocked`. */
export type TLifecycleState =
  | { readonly kind: 'no-vault' }
  | { readonly kind: 'creating' }
  | {
      readonly kind: 'locked';
      readonly vaultKey: TVaultKey;
      readonly level: TLockLevel;
      readonly reason: TLockReason | null;
      readonly failure: TUnlockFailure | null;
    }
  /** A lock that arrives while the key is derived is kept and applied when the vault opens. */
  | {
      readonly kind: 'unlocking';
      readonly vaultKey: TVaultKey;
      readonly pendingLock: TLockReason | null;
      /** The quick lock's one try, or a credential (from a full lock, or past a quick one). */
      readonly via: 'quick' | 'credential' | 'device';
      /** The lock a failed credential goes back to: a mistyped password keeps a quick lock's chance. */
      readonly from: Extract<TLifecycleState, { readonly kind: 'locked' }>;
    }
  /** `quickReady`: quick unlock is set up here, so an idle or concealed lock keeps the key behind it. */
  | { readonly kind: 'unlocked'; readonly vaultKey: TVaultKey; readonly quickReady: boolean }
  /** A newer document schema: view and copy, never write. */
  | { readonly kind: 'read-only'; readonly vaultKey: TVaultKey; readonly quickReady: boolean }
  | {
      readonly kind: 'locking';
      readonly vaultKey: TVaultKey;
      readonly reason: TLockReason;
      readonly level: TLockLevel;
    };

/** Nothing is open and nothing waits behind a quick code: the process may be replaced (a new build). */
export function isFullyLocked(state: TLifecycleState): boolean {
  return state.kind === 'no-vault' || (state.kind === 'locked' && state.level === 'full');
}
