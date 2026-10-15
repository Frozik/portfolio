import type { Milliseconds } from '@frozik/utils/date/types';
import { z } from 'zod';

import type { IKnownVault, ISyncState, TSnapshotReason } from './ports';

/**
 * How the device stores read back what they wrote, whatever stores it: an
 * entry this version cannot read is skipped, never fatal.
 */
const KNOWN_VAULT_SCHEMA = z.object({
  vaultKey: z.string(),
  name: z.string(),
  description: z.string().catch(''),
  lastOpenedAt: z.number().nullable(),
  unsyncedChanges: z.boolean(),
});

export function readKnownVault(entry: unknown): readonly IKnownVault[] {
  const parsed = KNOWN_VAULT_SCHEMA.safeParse(entry);
  return parsed.success
    ? [{ ...parsed.data, lastOpenedAt: parsed.data.lastOpenedAt as Milliseconds | null }]
    : [];
}

const SYNC_STATE_SCHEMA = z.object({
  maxSeenRevision: z.int().nonnegative(),
  maxSeenKeyslotsEpoch: z.int().nonnegative(),
  cloudKeyslotsEpoch: z.int().nonnegative().optional(),
  retiredKeyIds: z.array(z.string()).optional(),
  hashAtMaxSeen: z.string().nullable(),
  keyId: z.string(),
  lastSyncedRev: z.string().nullable(),
  lastHlc: z
    .object({ wallMs: z.int().nonnegative(), counter: z.int().nonnegative(), node: z.string() })
    .nullable(),
});

/** A stored sync state; fields older versions lacked take what they meant then. */
export function readSyncState(entry: unknown): ISyncState | null {
  const parsed = SYNC_STATE_SCHEMA.safeParse(entry);
  if (!parsed.success) {
    return null;
  }
  const { cloudKeyslotsEpoch, retiredKeyIds, ...state } = parsed.data;
  return {
    ...state,
    cloudKeyslotsEpoch: cloudKeyslotsEpoch ?? state.maxSeenKeyslotsEpoch,
    retiredKeyIds: retiredKeyIds ?? [],
  };
}

const REASONS: ReadonlySet<string> = new Set<TSnapshotReason>([
  'before-sync',
  'periodic',
  'before-restore',
]);

/** Snapshots of the first version carried no reason: they were all taken before a sync. */
export function snapshotReasonOf(stored: string | null | undefined): TSnapshotReason {
  return REASONS.has(stored ?? '') ? (stored as TSnapshotReason) : 'before-sync';
}
