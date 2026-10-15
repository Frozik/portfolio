import { z } from 'zod';

import type { TLockReason } from './lifecycle-state';
import { isLockReason } from './lifecycle-state';
import type { IWipeNote } from './ports/process-wipe';

const NOTE_SCHEMA = z.object({ vaultKey: z.string(), reason: z.string() });

/** The note as the platform keeps it across the wipe. */
export function wipeNoteText(note: IWipeNote): string {
  return JSON.stringify(note);
}

/** The vault a kept note names, read without taking the note: the one to come back to after the wipe. */
export function vaultKeyOfNote(text: string | null): string | null {
  if (text === null) {
    return null;
  }
  try {
    const parsed = NOTE_SCHEMA.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.vaultKey : null;
  } catch {
    return null;
  }
}

/** Why this vault was locked, from a kept note; `null` for another vault's note, none, or a garbled one. */
export function lockReasonFromNote(text: string | null, vaultKey: string): TLockReason | null {
  if (text === null) {
    return null;
  }
  try {
    const parsed = NOTE_SCHEMA.safeParse(JSON.parse(text));
    return parsed.success && parsed.data.vaultKey === vaultKey && isLockReason(parsed.data.reason)
      ? parsed.data.reason
      : null;
  } catch {
    return null;
  }
}
