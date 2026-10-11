import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import type {
  IStorageObjectStat,
  TStorageRev,
  TWritePrecondition,
} from '@frozik/cloud-storage/core/storage-provider';

/** What this device has seen, kept so an older file is merged and a security rollback refused. */
export interface ISyncGuard {
  readonly vaultId: string;
  readonly keyId: string;
  readonly maxSeenRevision: number;
  readonly maxSeenKeyslotsEpoch: number;
  /** Hash of the file seen at `maxSeenRevision`: the same revision with other bytes is a rollback too. */
  readonly hashAtMaxSeen: string | null;
  /**
   * Keys this device rotated away from: a file under one of
   * them is a rollback to a key that may have leaked, never a rotation to follow.
   */
  readonly retiredKeyIds: readonly string[];
}

export interface ISyncContext {
  readonly guard: ISyncGuard;
  /** The revision this replica last wrote or fully took in; `null` before the first exchange. */
  readonly lastSyncedRev: TStorageRev | null;
  /** A change or a request came while a cycle ran: one more cycle follows. */
  readonly pending: boolean;
  /** Conflicts in a row; reset by success. */
  readonly attempt: number;
  /** The last file read was older than one seen before: merged, and the user gets a quiet warning. */
  readonly rolledBack: boolean;
}

export type TSyncIntent = 'push' | 'pull';

/** Why an engine stopped; each needs the user or the lifecycle. */
export type TSyncStop =
  | { readonly kind: 'foreign-vault' }
  | { readonly kind: 'rollback-security' }
  | { readonly kind: 'key-rotated' }
  | { readonly kind: 'read-only' }
  | { readonly kind: 'corrupted' }
  /** The vault moved to another provider; the old file only points there. */
  | { readonly kind: 'moved'; readonly to: string };

export type TSyncPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'statting'; readonly intent: TSyncIntent }
  | { readonly kind: 'reading'; readonly stat: IStorageObjectStat }
  | { readonly kind: 'opening'; readonly stat: IStorageObjectStat }
  | { readonly kind: 'merging'; readonly stat: IStorageObjectStat; readonly remoteRevision: number }
  | {
      readonly kind: 'sealing';
      readonly precondition: TWritePrecondition;
      readonly revision: number;
    }
  | {
      readonly kind: 'writing';
      readonly precondition: TWritePrecondition;
      readonly revision: number;
      readonly fileHash: string;
      readonly keyslotsEpoch: number;
    }
  /** Waiting for a retry timer (too many conflicts, rate limits) or for the network to come back. */
  | { readonly kind: 'waiting'; readonly cause: TStorageError | { readonly kind: 'conflicts' } }
  | { readonly kind: 'stopped'; readonly reason: TSyncStop };

/** One replica exchange: the session's document with one storage target. */
export interface ISyncState {
  readonly context: ISyncContext;
  readonly phase: TSyncPhase;
}

export function initialSyncState(guard: ISyncGuard, lastSyncedRev: TStorageRev | null): ISyncState {
  return {
    context: { guard, lastSyncedRev, pending: false, attempt: 0, rolledBack: false },
    phase: { kind: 'idle' },
  };
}
