import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { TCredential } from './lifecycle-events';
import type { TLockReason } from './lifecycle-state';

/** What the shell must do; each outcome returns as an event. */
export type TLifecycleEffect =
  /** Calibrate, make the keys and the first file, write it locally, add it to the registry. */
  | {
      readonly kind: 'create';
      readonly name: string;
      readonly description: string;
      readonly password: TBytes;
    }
  /** Open the freshest copy (the cloud's when it is newer) with the credential, then forget the credential. */
  | { readonly kind: 'open'; readonly vaultKey: TVaultKey; readonly credential: TCredential }
  | {
      readonly kind: 'start-session';
      readonly vaultKey: TVaultKey;
      readonly access: 'read-write' | 'read-only';
    }
  /** The draft goes to the device store, sealed, before the session ends. */
  | { readonly kind: 'flush-draft' }
  /** Drop the key and the document, revoke blob URLs, clear the clipboard if focused, reload the page. */
  | {
      readonly kind: 'end-session-and-reload';
      readonly vaultKey: TVaultKey;
      readonly reason: TLockReason;
    }
  /** End the session without a wipe, the key kept behind the quick code for one try. */
  | { readonly kind: 'quick-lock'; readonly vaultKey: TVaultKey }
  /** Release the key with the code and reopen the local copy with it; a wrong code keeps nothing. */
  | { readonly kind: 'quick-open'; readonly vaultKey: TVaultKey; readonly code: string }
  /** Ask the platform's biometrics for the key, then reopen the local copy with it. */
  | { readonly kind: 'device-open'; readonly vaultKey: TVaultKey }
  | { readonly kind: 'make-read-only' }
  /** Point the registry at the vault's new place. */
  | { readonly kind: 'relocate'; readonly vaultKey: TVaultKey; readonly to: string };
