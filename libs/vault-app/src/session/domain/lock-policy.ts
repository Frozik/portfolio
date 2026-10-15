import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TLockLevel, TLockReason } from './lifecycle-state';

/** What a lock does besides closing the vault. */
export interface ILockConsequence {
  readonly level: TLockLevel;
  /** End the process: the only real wipe of the key and the document from memory. */
  readonly wipe: boolean;
  /** Lock this device's other clients too: one user, one session. */
  readonly tellPeers: boolean;
  /** Clear a copied secret now rather than when its timer ends. */
  readonly flushClipboard: boolean;
}

const FULL_FOR_EVERY_CLIENT: ILockConsequence = {
  level: 'full',
  wipe: true,
  tellPeers: true,
  flushClipboard: true,
};
const FULL_FOR_THIS_CLIENT: ILockConsequence = { ...FULL_FOR_EVERY_CLIENT, tellPeers: false };
const QUICK: ILockConsequence = {
  level: 'quick',
  wipe: false,
  tellPeers: false,
  flushClipboard: true,
};

/**
 * The user's own lock and those that make the key untrusted lock every
 * client; the lock button keeps a quick code like the idle locks do, "lock
 * completely" never does; idle, concealed and the like belong to one client — the one in use
 * must not lock because another sat idle — and are quick once quick unlock is
 * ready. A process that is going away, or a user who left for another part of
 * the app, needs no wipe; a process going away cannot write the clipboard.
 */
export function lockConsequence(reason: TLockReason, quickReady: boolean): ILockConsequence {
  switch (reason) {
    case 'manual':
      return quickReady ? { ...QUICK, tellPeers: true } : FULL_FOR_EVERY_CLIENT;
    case 'complete':
    case 'rollback-security':
    case 'forgotten':
    case 'update-required':
      return FULL_FOR_EVERY_CLIENT;
    case 'idle':
    case 'concealed':
    case 'sleep':
      return quickReady ? QUICK : FULL_FOR_THIS_CLIENT;
    case 'resumed':
    case 'other-client':
    case 'quick-unlock-failed':
    case 'quick-expired':
      return FULL_FOR_THIS_CLIENT;
    case 'left':
      return { level: 'full', wipe: false, tellPeers: false, flushClipboard: true };
    case 'unloading':
      return { level: 'full', wipe: false, tellPeers: false, flushClipboard: false };
    default:
      return assertNever(reason);
  }
}
