import { assert } from '@frozik/utils/assert/assert';
import type { Brand } from '@frozik/utils/types/base';

import { countBy, minBy } from 'lodash-es';

import { COLOR_SLOTS } from './group';
import type {
  ICustomGroup,
  IMyContactsGroup,
  IStrangersGroup,
  TGroup,
  TColorSlot,
  TGroupId,
} from './group';

interface IGroupBookShape {
  /** The user's groups in the order they were created, then «my contacts», then «strangers». */
  readonly groups: readonly TGroup[];
}

/**
 * Every group at once: the aggregate, because «a call is in exactly one group» binds all of
 * them. It is small (hundreds of members) and travels as one value.
 */
export type GroupBook = Brand<IGroupBookShape, 'GroupBook'>;

export function groupBook(groups: readonly TGroup[]): GroupBook {
  const custom = groups.filter(group => group.kind === 'custom');
  const myContacts = groups.filter(group => group.kind === 'my-contacts');
  const strangers = groups.filter(group => group.kind === 'strangers');
  assert(myContacts.length === 1, 'a group book has exactly one «my contacts»');
  assert(strangers.length === 1, 'a group book has exactly one «strangers»');
  assert(new Set(groups.map(group => group.id)).size === groups.length, 'group ids are unique');
  return { groups: [...custom, ...myContacts, ...strangers] } as IGroupBookShape as GroupBook;
}

/** The colour a new group starts with: one no group wears yet, else the least worn, so groups stay apart. */
export function freshColor(book: GroupBook): TColorSlot {
  const worn = countBy(book.groups, group => group.color);
  return minBy(COLOR_SLOTS, color => worn[color] ?? 0) ?? COLOR_SLOTS[0];
}

export function customGroups(book: GroupBook): readonly ICustomGroup[] {
  return book.groups.filter((group): group is ICustomGroup => group.kind === 'custom');
}

export function myContactsGroup(book: GroupBook): IMyContactsGroup {
  const group = book.groups.find(
    (candidate): candidate is IMyContactsGroup => candidate.kind === 'my-contacts'
  );
  assert(group !== undefined, 'a group book has «my contacts»');
  return group;
}

export function strangersGroup(book: GroupBook): IStrangersGroup {
  const group = book.groups.find(
    (candidate): candidate is IStrangersGroup => candidate.kind === 'strangers'
  );
  assert(group !== undefined, 'a group book has «strangers»');
  return group;
}

export function findGroup(book: GroupBook, id: TGroupId): TGroup | null {
  return book.groups.find(group => group.id === id) ?? null;
}

export function replaceGroup(book: GroupBook, replacement: TGroup): GroupBook {
  return groupBook(book.groups.map(group => (group.id === replacement.id ? replacement : group)));
}
