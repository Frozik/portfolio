import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TGroup, TGroupId } from './group';
import type { GroupBook } from './group-book';
import { findGroup, replaceGroup } from './group-book';
import type { TGroupBookEvent } from './group-book-events';
import type { TMember, TMemberId } from './member';

/** One step of an edit, the vocabulary edits and conflict resolutions are both written in. */
export type TGroupChange =
  | { readonly kind: 'add-include'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'remove-include'; readonly group: TGroupId; readonly member: TMemberId }
  | { readonly kind: 'add-exclude'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'remove-exclude'; readonly group: TGroupId; readonly member: TMemberId }
  | { readonly kind: 'exclude-my-contacts'; readonly group: TGroupId };

export interface IChanged {
  readonly book: GroupBook;
  readonly events: readonly TGroupBookEvent[];
}

function withInclude(
  group: TGroup,
  include: (members: readonly TMember[]) => readonly TMember[],
  now: Temporal.Instant
): TGroup {
  assert(group.kind === 'custom', 'only a group of the user has members to include');
  return { ...group, include: include(group.include), updatedAt: now };
}

function withExclude(
  group: TGroup,
  exclude: (members: readonly TMember[]) => readonly TMember[],
  now: Temporal.Instant
): TGroup {
  assert(group.kind !== 'strangers', '«strangers» take nobody, so they exclude nobody');
  return { ...group, exclude: exclude(group.exclude), updatedAt: now };
}

function applyOne(book: GroupBook, change: TGroupChange, now: Temporal.Instant): IChanged {
  const group = findGroup(book, change.group);
  assert(group !== null, 'a change names a group of the book');
  switch (change.kind) {
    case 'add-include':
      return {
        book: replaceGroup(
          book,
          withInclude(group, members => [...members, change.member], now)
        ),
        events: [{ kind: 'member-added', group: group.id, member: change.member }],
      };
    case 'remove-include': {
      const removed =
        group.kind === 'custom'
          ? group.include.find(member => member.id === change.member)
          : undefined;
      return {
        book: replaceGroup(
          book,
          withInclude(group, members => members.filter(member => member.id !== change.member), now)
        ),
        events:
          removed === undefined
            ? []
            : [{ kind: 'member-removed', group: group.id, member: removed }],
      };
    }
    case 'add-exclude':
      return {
        book: replaceGroup(
          book,
          withExclude(group, members => [...members, change.member], now)
        ),
        events: [{ kind: 'excluded', group: group.id, member: change.member }],
      };
    case 'remove-exclude': {
      const removed =
        group.kind === 'strangers'
          ? undefined
          : group.exclude.find(member => member.id === change.member);
      return {
        book: replaceGroup(
          book,
          withExclude(group, members => members.filter(member => member.id !== change.member), now)
        ),
        events:
          removed === undefined
            ? []
            : [{ kind: 'exclusion-removed', group: group.id, member: removed }],
      };
    }
    case 'exclude-my-contacts':
      assert(group.kind === 'custom', 'only a group of the user excludes the address book');
      return {
        book: replaceGroup(book, { ...group, excludeMyContacts: true, updatedAt: now }),
        events: [{ kind: 'my-contacts-excluded', group: group.id }],
      };
    default:
      return assertNever(change);
  }
}

export function applyChanges(
  book: GroupBook,
  changes: readonly TGroupChange[],
  now: Temporal.Instant
): IChanged {
  return changes.reduce<IChanged>(
    (current, change) => {
      const next = applyOne(current.book, change, now);
      return { book: next.book, events: [...current.events, ...next.events] };
    },
    { book, events: [] }
  );
}
