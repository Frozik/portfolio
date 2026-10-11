import { isNil, sortBy, uniq } from 'lodash-es';

import { toHex } from '../crypto/bytes';
import type { TKeyslot } from '../crypto/keyslot';

/** A slot set and the epoch it was written at. */
interface IEpochSlots {
  readonly slots: readonly TKeyslot[];
  readonly epoch: number;
}

/** What a slot stands for: the password, the recovery key, or one passkey credential. */
function unitOf(slot: TKeyslot): string {
  return slot.kind === 'prf' ? `prf:${toHex(slot.credentialId)}` : slot.kind;
}

/** A slot is its wrapped key: salt and nonce are fresh for every slot, so equal bytes mean the same slot. */
function bytesOf(slots: readonly TKeyslot[]): string {
  return sortBy(slots.map(slot => toHex(slot.wrappedDek))).join('|');
}

function ofUnit(slots: readonly TKeyslot[], unit: string): readonly TKeyslot[] {
  return slots.filter(slot => unitOf(slot) === unit);
}

/**
 * Two devices changed the slots from the same epoch (one made
 * a recovery key, the other a new password, each added its own passkey).
 * Slots are self-contained wrapped keys, so the sets merge without any
 * secret: per unit, the side that changed it since the common base wins
 * (a removal included); without a base an added slot beats none; when both
 * changed it, the later epoch wins, and at the same epoch the lower bytes —
 * every device picks the same, so the copies converge.
 */
export function mergeKeyslots(
  base: readonly TKeyslot[] | null,
  { slots: mine, epoch: mineEpoch }: IEpochSlots,
  { slots: theirs, epoch: theirsEpoch }: IEpochSlots
): readonly TKeyslot[] {
  const units = sortBy(uniq([...(base ?? []), ...mine, ...theirs].map(unitOf)));
  return units.flatMap(unit => {
    const own = ofUnit(mine, unit);
    const other = ofUnit(theirs, unit);
    if (bytesOf(own) === bytesOf(other)) {
      return own;
    }
    const baseOfUnit = isNil(base) ? null : bytesOf(ofUnit(base, unit));
    if (baseOfUnit === bytesOf(own)) {
      return other;
    }
    if (baseOfUnit === bytesOf(other)) {
      return own;
    }
    if (own.length === 0 || other.length === 0) {
      return own.length === 0 ? other : own;
    }
    if (mineEpoch !== theirsEpoch) {
      return mineEpoch > theirsEpoch ? own : other;
    }
    return bytesOf(own) < bytesOf(other) ? own : other;
  });
}

export function sameKeyslots(first: readonly TKeyslot[], second: readonly TKeyslot[]): boolean {
  return bytesOf(first) === bytesOf(second);
}
