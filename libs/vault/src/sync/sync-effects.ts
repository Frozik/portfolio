import type { TWritePrecondition } from '@frozik/cloud-storage/core/storage-provider';

import type { IVaultKeys } from '../format/vault-keys';
import type { IVaultDocument } from '../model/vault-document';
import type { ISyncGuard } from './sync-state';

/**
 * What the shell must do, as data. Each effect's outcome
 * comes back as an event; the step itself never waits for anything.
 */
export type TSyncEffect =
  | { readonly kind: 'stat' }
  | { readonly kind: 'read' }
  | { readonly kind: 'open'; readonly file: Uint8Array<ArrayBuffer> }
  /** Merge into the session's document as it is now; answer whether it holds anything the remote lacks. */
  | {
      readonly kind: 'merge';
      readonly remote: IVaultDocument;
      /**
       * The accepted file's slot set: the session weighs it
       * against its own, and holding newer slots is news to write even with
       * the same cards.
       */
      readonly keys: IVaultKeys;
    }
  /** Seal the session's document as it is now under this revision. */
  | { readonly kind: 'seal'; readonly revision: number }
  | {
      readonly kind: 'write';
      readonly file: Uint8Array<ArrayBuffer>;
      readonly precondition: TWritePrecondition;
    }
  /** A slot set reached the target: the session's own change is shared from now on. */
  | { readonly kind: 'keys-shared'; readonly keyslotsEpoch: number }
  | {
      readonly kind: 'save-guard';
      readonly guard: ISyncGuard;
      readonly lastSyncedRev: string | null;
    }
  /** The shell turns the attempt into a delay with jitter (`retryDelay`) and answers `retry-due` with the same attempt. */
  | { readonly kind: 'schedule-retry'; readonly attempt: number };
