import type { Temporal } from 'temporal-polyfill';

import type { IPolicy } from '../../policy/domain/policy';
import type { IConflictFacts } from './conflict-detection';
import type { TEditOutcome } from './edit-outcome';
import { guarded, rejected } from './edit-outcome';
import type { IAutoReply, ICustomGroup, TGroup, TGroupColor, TGroupId } from './group';
import type { GroupBook } from './group-book';
import { findGroup, findMask, groupBook, myContactsGroup, replaceGroup } from './group-book';
import type { TGroupChange } from './group-changes';
import { applyChanges } from './group-changes';
import type { INameMaskMember, INumberMaskMember, TMember, TMemberId } from './member';
import { claims } from './membership';
import { pickedContactAsCaller } from './picked-contact';

export interface INewGroup {
  readonly id: TGroupId;
  readonly name: string;
  readonly color: TGroupColor;
  readonly policy: IPolicy;
  readonly now: Temporal.Instant;
}

export function createGroup(book: GroupBook, command: INewGroup): TEditOutcome {
  const group: ICustomGroup = {
    kind: 'custom',
    id: command.id,
    name: command.name,
    color: command.color,
    include: [],
    exclude: [],
    excludeMyContacts: true,
    policy: command.policy,
    enabled: true,
    autoReply: null,
    createdAt: command.now,
    updatedAt: command.now,
  };
  return {
    kind: 'applied',
    book: groupBook([...book.groups, group]),
    events: [{ kind: 'group-created', group: group.id }],
  };
}

/** Removing a group also removes what it made other groups exclude: those callers come back. */
export function deleteGroup(book: GroupBook, id: TGroupId, now: Temporal.Instant): TEditOutcome {
  const group = findGroup(book, id);
  if (group?.kind !== 'custom') {
    return rejected('not-a-group-of-the-user');
  }
  const rest = book.groups
    .filter(other => other.id !== id)
    .map((other): TGroup => {
      if (other.kind === 'strangers' || !other.exclude.some(member => member.excludedFor === id)) {
        return other;
      }
      return {
        ...other,
        exclude: other.exclude.filter(member => member.excludedFor !== id),
        updatedAt: now,
      };
    });
  return { kind: 'applied', book: groupBook(rest), events: [{ kind: 'group-deleted', group: id }] };
}

export interface IGroupSettings {
  readonly name?: string;
  readonly color?: TGroupColor;
  readonly policy?: IPolicy;
  readonly autoReply?: IAutoReply | null;
  readonly enabled?: boolean;
}

export function changeGroup(
  book: GroupBook,
  id: TGroupId,
  settings: IGroupSettings,
  now: Temporal.Instant
): TEditOutcome {
  const group = findGroup(book, id);
  if (group === null) {
    return rejected('unknown-group');
  }
  const { name, ...shared } = settings;
  const changed: TGroup =
    group.kind === 'custom'
      ? { ...group, ...shared, name: name ?? group.name, updatedAt: now }
      : { ...group, ...shared, updatedAt: now };
  return {
    kind: 'applied',
    book: replaceGroup(book, changed),
    events: [{ kind: 'group-changed', group: id }],
  };
}

export interface IMemberCommand {
  readonly group: TGroupId;
  readonly side: 'include' | 'exclude';
  readonly member: TMember;
  readonly newMemberId: () => TMemberId;
  readonly now: Temporal.Instant;
  readonly facts: IConflictFacts;
}

/**
 * A picked contact goes to its group and leaves «my contacts» in the same step, so adding
 * «Mum» to «Family» never stops at a conflict.
 */
export function addMember(book: GroupBook, command: IMemberCommand): TEditOutcome {
  const group = findGroup(book, command.group);
  if (group === null) {
    return rejected('unknown-group');
  }
  if (group.kind === 'strangers') {
    return rejected('strangers-take-nobody');
  }
  if (group.kind === 'my-contacts' && command.side === 'include') {
    return rejected('not-a-group-of-the-user');
  }
  const changes: TGroupChange[] = [
    {
      kind: command.side === 'include' ? 'add-include' : 'add-exclude',
      group: group.id,
      member: command.member,
    },
  ];
  const myContacts = myContactsGroup(book);
  if (
    command.side === 'include' &&
    command.member.kind === 'contact' &&
    claims(myContacts, pickedContactAsCaller(command.member), command.facts.environment)
  ) {
    changes.push({
      kind: 'add-exclude',
      group: myContacts.id,
      member: { ...command.member, id: command.newMemberId(), excludedFor: group.id },
    });
  }
  const changed = applyChanges(book, changes, command.now);
  return guarded(book, changed.book, changed.events, command.facts);
}

/** Taking a picked contact out of a group also takes back the exclusion it left in «my contacts». */
export function removeMember(
  book: GroupBook,
  groupId: TGroupId,
  side: 'include' | 'exclude',
  memberId: TMemberId,
  now: Temporal.Instant
): TEditOutcome {
  const group = findGroup(book, groupId);
  if (group === null || group.kind === 'strangers') {
    return rejected('unknown-group');
  }
  const changes: TGroupChange[] = [
    {
      kind: side === 'include' ? 'remove-include' : 'remove-exclude',
      group: groupId,
      member: memberId,
    },
  ];
  const removed =
    group.kind === 'custom' && side === 'include'
      ? group.include.find(member => member.id === memberId)
      : undefined;
  if (removed?.kind === 'contact') {
    const myContacts = myContactsGroup(book);
    for (const exclusion of myContacts.exclude) {
      const sameContact =
        exclusion.kind === 'contact' &&
        exclusion.excludedFor === groupId &&
        (exclusion.lookupKey === removed.lookupKey ||
          exclusion.numbers.some(number => removed.numbers.includes(number)));
      if (sameContact) {
        changes.push({ kind: 'remove-exclude', group: myContacts.id, member: exclusion.id });
      }
    }
  }
  const changed = applyChanges(book, changes, now);
  return { kind: 'applied', book: changed.book, events: changed.events };
}

export interface IMaskRewrite {
  readonly group: TGroupId;
  readonly side: 'include' | 'exclude';
  /** The mask as it is now written; its id names the one it replaces. */
  readonly member: INumberMaskMember | INameMaskMember;
  readonly now: Temporal.Instant;
  readonly facts: IConflictFacts;
}

/**
 * A mask of the group written anew where it stands — «IP Isanshin» becoming «IP*»: its note and
 * the exclusion it may stand for stay, and a conflict the new mask makes stops it as an addition would.
 */
export function replaceMask(book: GroupBook, command: IMaskRewrite): TEditOutcome {
  const group = findGroup(book, command.group);
  if (group === null || group.kind === 'strangers') {
    return rejected('unknown-group');
  }
  const old = findMask(book, group.id, command.side, command.member.id);
  if (old === null) {
    return rejected('unknown-member');
  }
  const rewritten: TMember = {
    ...command.member,
    note: old.note,
    excludedFor: old.excludedFor,
    updatedAt: command.now,
  };
  const rewrite = (members: readonly TMember[]) =>
    members.map(member => (member.id === old.id ? rewritten : member));
  const after = replaceGroup(
    book,
    command.side === 'include' && group.kind === 'custom'
      ? { ...group, include: rewrite(group.include), updatedAt: command.now }
      : { ...group, exclude: rewrite(group.exclude), updatedAt: command.now }
  );
  return guarded(book, after, [{ kind: 'group-changed', group: group.id }], command.facts);
}

export function setExcludeMyContacts(
  book: GroupBook,
  id: TGroupId,
  value: boolean,
  now: Temporal.Instant,
  facts: IConflictFacts
): TEditOutcome {
  const group = findGroup(book, id);
  if (group?.kind !== 'custom') {
    return rejected('not-a-group-of-the-user');
  }
  const after = replaceGroup(book, { ...group, excludeMyContacts: value, updatedAt: now });
  return guarded(book, after, [{ kind: 'group-changed', group: id }], facts);
}
