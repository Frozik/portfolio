import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import { parseNameMask } from '../../masks/domain/name-mask';
import { parseNumberMask } from '../../masks/domain/number-mask';
import { exactText } from '../../masks/domain/pattern';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { TNormalizedName } from '../../phone/domain/name-normalization';
import type { TGroupId } from './group';
import type {
  IContactMember,
  INameMaskMember,
  INumberMaskMember,
  TMember,
  TMemberId,
} from './member';

export interface IMemberStamp {
  readonly id: TMemberId;
  readonly now: Temporal.Instant;
  readonly excludedFor: TGroupId | null;
}

const NAME_MASK_SPECIAL = /[.*{}\\]/g;

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

export function exactNetworkNameMember(
  name: TNormalizedName,
  stamp: IMemberStamp
): INameMaskMember {
  const mask = parseNameMask(name.replace(NAME_MASK_SPECIAL, '\\$&'));
  assert(mask.ok, 'a normalized name always makes a mask');
  return {
    kind: 'name-mask',
    id: stamp.id,
    mask: mask.value,
    field: 'network',
    note: '',
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
export function isExactFor(member: TMember, caller: ICaller, by: 'number' | 'name'): boolean {
  switch (member.kind) {
    case 'number-mask':
      return (
        by === 'number' &&
        member.mask.international &&
        exactText(member.mask.pattern) === caller.number
      );
    case 'name-mask':
      return (
        by === 'name' &&
        member.field !== 'contact' &&
        exactText(member.mask.pattern) === caller.networkName
      );
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
