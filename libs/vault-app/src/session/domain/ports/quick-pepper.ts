import type { TBytes } from '@frozik/vault/crypto/bytes';

/**
 * A secret made at each full unlock that never leaves this process: a quick
 * code is mixed with it, so a memory dump without it gives a short code
 * nothing to be tried against.
 */
export interface IQuickPepper {
  /** A fresh pepper for this session; the one before is gone. */
  renew(): Promise<void>;
  /** The canonical code mixed with the pepper; `null` once the pepper is gone. */
  mix(canonicalCode: string): Promise<TBytes | null>;
  destroy(): void;
}
