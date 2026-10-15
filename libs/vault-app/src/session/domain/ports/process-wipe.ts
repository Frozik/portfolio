import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TLockReason } from '../lifecycle-state';

/** What a wipe tells the process after it: which vault locked, and why. */
export interface IWipeNote {
  readonly vaultKey: TVaultKey;
  readonly reason: TLockReason;
}

/**
 * The only real wipe of keys and documents from memory: the process starts
 * over (a page reload, the extension's restart, a new JavaScript runtime). A
 * short note survives it, so the unlock screen can say why it is there.
 */
export interface IProcessWipe {
  wipe(note: IWipeNote): void;
  /** The note a wipe left for this vault, once; `null` when there is none. */
  takeNote(vaultKey: TVaultKey): TLockReason | null;
}
