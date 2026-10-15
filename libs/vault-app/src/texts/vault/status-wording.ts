import { assertNever } from '@frozik/utils/assert/assertNever';
import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { ISnapshotEntry } from '@frozik/vault/persistence/ports';
import type { ISyncState } from '@frozik/vault/sync/sync-state';
import type { TVaultTexts } from './vault-texts';

import type { TAttachRefusal } from '../../document/domain/new-file';

const BYTES_PER_KILOBYTE = 1024;

export function saveStatusText(t: TVaultTexts, state: ISyncState): string {
  const { phase } = state;
  switch (phase.kind) {
    case 'idle':
      return t.status.saved;
    case 'waiting':
      return t.status.waiting;
    case 'stopped':
      return t.status.stopped[phase.reason.kind];
    case 'statting':
    case 'reading':
    case 'opening':
    case 'merging':
    case 'sealing':
    case 'writing':
      return t.status.saving;
    default:
      return assertNever(phase);
  }
}

export function attachRefusalText(t: TVaultTexts, refusal: TAttachRefusal): string {
  switch (refusal) {
    case 'too-large':
      return t.files.tooLarge;
    case 'not-stored':
      return t.files.notStored;
    case 'read-only':
      return t.status.readOnly;
    default:
      return assertNever(refusal);
  }
}

export function snapshotTimeText(entry: ISnapshotEntry): string {
  return formatDateTimeLocal(millisecondsToISO8601(entry.takenAt));
}

/** Whole kilobytes, at least one: a backup is never "0 kB". */
export function snapshotSizeText(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 0,
  }).format(Math.max(1, bytes / BYTES_PER_KILOBYTE));
}
