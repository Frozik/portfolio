import type { Temporal } from 'temporal-polyfill';

import type { ICaller } from '../../phone/domain/caller';
import type { IConflictFacts } from './conflict-detection';
import type { TEditOutcome } from './edit-outcome';
import { guarded, rejected } from './edit-outcome';
import {
  contactMemberOf,
  exactNetworkNameMember,
  exactNumberMember,
  isExactFor,
} from './exact-members';
import type { TAssignableGroup, TGroupId } from './group';
import type { GroupBook } from './group-book';
import { findGroup } from './group-book';
import type { TGroupChange } from './group-changes';
import { applyChanges } from './group-changes';
import type { TMember, TMemberId } from './member';
import { claims } from './membership';

export type TMoveKey = 'number' | 'name';

export interface IMoveCommand {
  readonly caller: ICaller;
  readonly by: TMoveKey;
  readonly target: TGroupId;
  /** Shown next to the exact mask: the contact's name, the operator's, or the day of the call. */
  readonly note: string;
  readonly newMemberId: () => TMemberId;
  readonly now: Temporal.Instant;
  readonly facts: IConflictFacts;
}

function exactMemberFor(command: IMoveCommand, excludedFor: TGroupId | null): TMember | null {
  const stamp = { id: command.newMemberId(), now: command.now, excludedFor };
  const { caller } = command;
  if (command.by === 'name') {
    return caller.networkName === null ? null : exactNetworkNameMember(caller.networkName, stamp);
  }
  if (caller.contact !== null) {
    return contactMemberOf(caller, stamp);
  }
  return caller.number === null ? null : exactNumberMember(caller.number, command.note, stamp);
}

/** Changes that take the caller out of a group: its exact mask goes, and a pattern gets an exception. */
function leaveGroup(
  book: GroupBook,
  group: TAssignableGroup,
  command: IMoveCommand,
  excludedFor: TGroupId | null
): readonly TGroupChange[] {
  const removals: TGroupChange[] =
    group.kind === 'custom'
      ? group.include
          .filter(member => isExactFor(member, command.caller, command.by))
          .map(member => ({ kind: 'remove-include', group: group.id, member: member.id }))
      : [];
  const afterRemovals = applyChanges(book, removals, command.now).book;
  const stillThere = findGroup(afterRemovals, group.id);
  if (
    stillThere === null ||
    stillThere.kind === 'strangers' ||
    !claims(stillThere, command.caller, command.facts.environment)
  ) {
    return removals;
  }
  const exclusion = exactMemberFor(command, excludedFor);
  return exclusion === null
    ? removals
    : [...removals, { kind: 'add-exclude', group: group.id, member: exclusion }];
}

function otherClaimants(book: GroupBook, command: IMoveCommand): readonly TAssignableGroup[] {
  return book.groups.filter(
    (group): group is TAssignableGroup =>
      group.kind !== 'strangers' &&
      group.id !== command.target &&
      claims(group, command.caller, command.facts.environment)
  );
}

/**
 * «To group…»: the caller ends up in the target and nowhere else. An exact mask goes into
 * the target (a picked contact for a contact, so «exclude my contacts» never drops them),
 * and every other group that took them gets an exception, or loses its exact mask.
 */
export function moveCaller(book: GroupBook, command: IMoveCommand): TEditOutcome {
  const target = findGroup(book, command.target);
  if (target === null) {
    return rejected('unknown-group');
  }
  if (target.kind === 'strangers') {
    return rejected('strangers-take-nobody');
  }
  if (target.kind === 'my-contacts' && command.caller.contact === null) {
    return rejected('not-a-contact');
  }
  const intoTarget: TGroupChange[] = [];
  if (target.kind === 'my-contacts') {
    intoTarget.push(
      ...target.exclude
        .filter(member => isExactFor(member, command.caller, command.by))
        .map((member): TGroupChange => ({
          kind: 'remove-exclude',
          group: target.id,
          member: member.id,
        }))
    );
  } else if (!claims(target, command.caller, command.facts.environment)) {
    const member = exactMemberFor(command, null);
    if (member === null) {
      return rejected('nothing-to-move');
    }
    intoTarget.push(
      ...target.exclude
        .filter(exclusion => isExactFor(exclusion, command.caller, command.by))
        .map((exclusion): TGroupChange => ({
          kind: 'remove-exclude',
          group: target.id,
          member: exclusion.id,
        })),
      { kind: 'add-include', group: target.id, member }
    );
  }
  const withTarget = applyChanges(book, intoTarget, command.now);
  const leaving = otherClaimants(withTarget.book, command).flatMap(group =>
    leaveGroup(withTarget.book, group, command, target.id)
  );
  const moved = applyChanges(withTarget.book, leaving, command.now);
  return guarded(book, moved.book, [...withTarget.events, ...moved.events], command.facts);
}

export interface IRemoveCallerCommand {
  readonly caller: ICaller;
  readonly by: TMoveKey;
  readonly group: TGroupId;
  readonly newMemberId: () => TMemberId;
  readonly now: Temporal.Instant;
  readonly facts: IConflictFacts;
}

/**
 * «Remove from group»: the caller falls to wherever the remaining rules put them — «my
 * contacts» for a contact, otherwise «strangers», or another group whose mask takes them.
 */
export function removeCallerFromGroup(
  book: GroupBook,
  command: IRemoveCallerCommand
): TEditOutcome {
  const group = findGroup(book, command.group);
  if (group === null || group.kind === 'strangers') {
    return rejected('strangers-take-nobody');
  }
  const move: IMoveCommand = { ...command, target: command.group, note: '' };
  const leftBehind = book.groups.flatMap((other): TGroupChange[] =>
    other.kind === 'strangers'
      ? []
      : other.exclude
          .filter(
            member =>
              member.excludedFor === command.group && isExactFor(member, command.caller, command.by)
          )
          .map(member => ({ kind: 'remove-exclude', group: other.id, member: member.id }))
  );
  const changes = [...leaveGroup(book, group, move, null), ...leftBehind];
  const changed = applyChanges(book, changes, command.now);
  return guarded(book, changed.book, changed.events, command.facts);
}
