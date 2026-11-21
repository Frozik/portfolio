import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import { parseNumberMask } from '../../masks/domain/number-mask';
import { exactText } from '../../masks/domain/pattern';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { TGroupId } from './group';
import type { IContactMember, INumberMaskMember, TMember, TMemberId } from './member';

export interface IMemberStamp {
  readonly id: TMemberId;
  readonly now: Temporal.Instant;
  readonly excludedFor: TGroupId | null;
}

export function exactNumberMember(
  digits: TE164Digits,
  note: string,
  stamp: IMemberStamp
): INumberMaskMember {
  const mask = parseNumberMask(`+${digits}`);
  assert(mask.ok, 'international digits always make a mask');
  return {
    kind: 'number-mask',
    id: stamp.id,
    mask: mask.value,
    note,
    updatedAt: stamp.now,
    excludedFor: stamp.excludedFor,
  };
}

/** A whole pool of numbers, the range a catalogue says one operator holds: `+7986*` for `7986`. */
export function poolMember(pool: string, note: string, stamp: IMemberStamp): INumberMaskMember {
  const mask = parseNumberMask(`+${pool}*`);
  assert(mask.ok, 'a range of digits always makes a mask');
  return {
    kind: 'number-mask',
    id: stamp.id,
    mask: mask.value,
    note,
    updatedAt: stamp.now,
    excludedFor: stamp.excludedFor,
  };
}

export function contactMemberOf(caller: ICaller, stamp: IMemberStamp): IContactMember {
  assert(caller.contact !== null, 'only a contact makes a contact member');
  return {
    kind: 'contact',
    id: stamp.id,
    displayName: caller.contact.displayName,
    numbers: caller.number === null ? [] : [caller.number],
    lookupKey: caller.contact.lookupKey,
    updatedAt: stamp.now,
    excludedFor: stamp.excludedFor,
  };
}

/** What names this caller exactly — the member a move adds, and the one taking them out removes. */
export function isExactFor(member: TMember, caller: ICaller): boolean {
  switch (member.kind) {
    case 'number-mask':
      return member.mask.international && exactText(member.mask.pattern) === caller.number;
    case 'contact':
      return (
        caller.contact !== null &&
        (member.lookupKey === caller.contact.lookupKey ||
          (caller.number !== null && member.numbers.includes(caller.number)))
      );
    case 'special':
      return false;
    default:
      return assertNever(member);
  }
}
