import { assert } from '@frozik/utils/assert/assert';
import { Temporal } from 'temporal-polyfill';

import { parseNameMask } from '../../masks/domain/name-mask';
import { parseNumberMask } from '../../masks/domain/number-mask';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import { normalizeName } from '../../phone/domain/name-normalization';
import { ALWAYS_BLOCK, ALWAYS_PASS } from '../../policy/domain/policy';
import type { IConflictFacts } from '../domain/conflict-detection';
import type { ICustomGroup, IMyContactsGroup, IStrangersGroup, TGroupId } from '../domain/group';
import type { GroupBook } from '../domain/group-book';
import { groupBook } from '../domain/group-book';
import type { IMatchingEnvironment } from '../domain/matching-environment';
import type {
  IContactMember,
  TMember,
  TMemberId,
  TNameField,
  TSpecialMask,
} from '../domain/member';

export const NOW = Temporal.Instant.from('2026-11-09T10:00:00Z');

export const NETHERLANDS_HOME: IMatchingEnvironment = {
  home: { country: 'NL' as TCountryCode, callingCode: '31', nationalPrefix: '0' },
  networkCountry: 'NL' as TCountryCode,
};

let sequence = 0;

export function newMemberId(): TMemberId {
  sequence += 1;
  return `member-${sequence}` as TMemberId;
}

export function numberMask(source: string): TMember {
  const mask = parseNumberMask(source);
  assert(mask.ok, `${source} parses`);
  return {
    kind: 'number-mask',
    id: newMemberId(),
    mask: mask.value,
    note: '',
    updatedAt: NOW,
    excludedFor: null,
  };
}

export function nameMask(source: string, field: TNameField = 'any'): TMember {
  const mask = parseNameMask(source);
  assert(mask.ok, `${source} parses`);
  return {
    kind: 'name-mask',
    id: newMemberId(),
    mask: mask.value,
    field,
    note: '',
    updatedAt: NOW,
    excludedFor: null,
  };
}

export function special(kind: TSpecialMask): TMember {
  return { kind: 'special', id: newMemberId(), special: kind, updatedAt: NOW, excludedFor: null };
}

export function pickedContact(displayName: string, digits: string): IContactMember {
  return {
    kind: 'contact',
    id: newMemberId(),
    displayName,
    numbers: [digits as TE164Digits],
    lookupKey: `lookup-${displayName}`,
    updatedAt: NOW,
    excludedFor: null,
  };
}

export function custom(
  id: string,
  include: readonly TMember[],
  overrides: Partial<Omit<ICustomGroup, 'kind' | 'id'>> = {}
): ICustomGroup {
  return {
    kind: 'custom',
    id: id as TGroupId,
    name: id,
    color: 'blue',
    include,
    exclude: [],
    excludeMyContacts: true,
    policy: ALWAYS_BLOCK,
    temporary: null,
    autoReply: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export const MY_CONTACTS_ID = 'my-contacts' as TGroupId;
export const STRANGERS_ID = 'strangers' as TGroupId;

export function bookOf(
  groups: readonly ICustomGroup[],
  myContactsExclude: readonly TMember[] = []
): GroupBook {
  const myContacts: IMyContactsGroup = {
    kind: 'my-contacts',
    id: MY_CONTACTS_ID,
    color: 'green',
    exclude: myContactsExclude,
    policy: ALWAYS_PASS,
    temporary: null,
    autoReply: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const strangers: IStrangersGroup = {
    kind: 'strangers',
    id: STRANGERS_ID,
    color: 'slate',
    policy: ALWAYS_PASS,
    temporary: null,
    autoReply: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return groupBook([...groups, myContacts, strangers]);
}

export function stranger(digits: string, networkName: string | null = null): ICaller {
  return {
    number: digits as TE164Digits,
    traits: { country: 'NL' as TCountryCode, type: 'mobile' },
    networkName: networkName === null ? null : normalizeName(networkName),
    contact: null,
  };
}

export function contact(displayName: string, digits: string): ICaller {
  return {
    number: digits as TE164Digits,
    traits: { country: 'NL' as TCountryCode, type: 'mobile' },
    networkName: null,
    contact: { lookupKey: `lookup-${displayName}`, displayName, name: normalizeName(displayName) },
  };
}

export function factsWith(knownCallers: readonly ICaller[] = []): IConflictFacts {
  return { environment: NETHERLANDS_HOME, knownCallers };
}
