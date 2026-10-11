import { isEqual, isNil, uniq } from 'lodash-es';

import type { ICardField, ICardState, ICardTab } from './card';
import { allFields } from './card';
import { tabLayout } from './card-diff';
import type { TFieldId } from './ids';

/** The parts of a card combined one by one. */
export type TCombineAspect =
  | 'title'
  | 'favorite'
  | 'protected'
  | 'archived'
  | 'trashed'
  | 'color'
  | 'icon'
  | 'tabs'
  | 'groups'
  | `field:${TFieldId}`;

export type TCombineSide = 'mine' | 'theirs';

/** What the user chose for each aspect both sides changed differently; the fresher version (`theirs`) otherwise. */
export type TCombineChoices = ReadonlyMap<TCombineAspect, TCombineSide>;

function isClash(base: unknown, theirs: unknown, mine: unknown): boolean {
  return !isEqual(mine, base) && !isEqual(theirs, base) && !isEqual(mine, theirs);
}

/** Stands for the value in a common ancestor that is not known: equal to nothing, so any difference is a clash. */
const NO_ANCESTOR = Symbol('no common ancestor');

type TAncestor = ICardState | null;

interface IValueAspect {
  readonly aspect: TCombineAspect;
  isClash(base: TAncestor, theirs: ICardState, mine: ICardState): boolean;
  resolve(
    base: TAncestor,
    theirs: ICardState,
    mine: ICardState,
    choice: TCombineSide | undefined,
    into: ICardState
  ): ICardState;
}

/** Three-way: a change on one side wins over no change; a clash goes by choice, the fresher side by default. */
function sideOf(
  base: unknown,
  theirs: unknown,
  mine: unknown,
  choice: TCombineSide | undefined
): TCombineSide {
  if (isEqual(mine, base)) {
    return 'theirs';
  }
  if (isEqual(theirs, base) || isEqual(mine, theirs)) {
    return 'mine';
  }
  return choice ?? 'theirs';
}

function pick<T>(
  base: T | typeof NO_ANCESTOR,
  theirs: T,
  mine: T,
  choice: TCombineSide | undefined
): T {
  return sideOf(base, theirs, mine, choice) === 'mine' ? mine : theirs;
}

function valueAspect<Key extends keyof ICardState>(aspect: TCombineAspect, key: Key): IValueAspect {
  return {
    aspect,
    isClash: (base, theirs, mine) =>
      isClash(isNil(base) ? NO_ANCESTOR : base[key], theirs[key], mine[key]),
    resolve: (base, theirs, mine, choice, into) => ({
      ...into,
      [key]: pick(isNil(base) ? NO_ANCESTOR : base[key], theirs[key], mine[key], choice),
    }),
  };
}

const VALUE_ASPECTS: readonly IValueAspect[] = [
  valueAspect('title', 'title'),
  valueAspect('favorite', 'favorite'),
  valueAspect('protected', 'protected'),
  valueAspect('archived', 'archivedAt'),
  valueAspect('trashed', 'trashedAt'),
  valueAspect('color', 'color'),
  valueAspect('icon', 'icon'),
];

/** A field's value in the base: absent there, or unknown when there is no common ancestor at all. */
function baseFieldOf(
  base: TAncestor,
  fields: ReadonlyMap<TFieldId, ICardField>,
  id: TFieldId
): ICardField | undefined | typeof NO_ANCESTOR {
  return isNil(base) ? NO_ANCESTOR : fields.get(id);
}

function fieldsById(card: TAncestor): ReadonlyMap<TFieldId, ICardField> {
  return new Map(isNil(card) ? [] : allFields(card).map(field => [field.id, field]));
}

function layoutOf(card: TAncestor, common: ReadonlySet<TFieldId>): unknown {
  return isNil(card) ? NO_ANCESTOR : tabLayout(card, common);
}

function fieldIds(...cards: readonly TAncestor[]): readonly TFieldId[] {
  return uniq(cards.flatMap(card => (isNil(card) ? [] : allFields(card).map(field => field.id))));
}

/** Every aspect both sides changed differently: what the conflict dialog asks about. */
export function combineClashes(
  base: TAncestor,
  theirs: ICardState,
  mine: ICardState
): readonly TCombineAspect[] {
  const clashes = VALUE_ASPECTS.filter(row => row.isClash(base, theirs, mine)).map(
    row => row.aspect
  );
  const [baseFields, theirFields, myFields] = [
    fieldsById(base),
    fieldsById(theirs),
    fieldsById(mine),
  ];
  for (const id of fieldIds(base, theirs, mine)) {
    if (isClash(baseFieldOf(base, baseFields, id), theirFields.get(id), myFields.get(id))) {
      clashes.push(`field:${id}`);
    }
  }
  const common = new Set(fieldIds(theirs).filter(id => myFields.has(id)));
  if (isClash(layoutOf(base, common), tabLayout(theirs, common), tabLayout(mine, common))) {
    clashes.push('tabs');
  }
  if (isNil(base) && isClash(NO_ANCESTOR, sortedGroups(theirs), sortedGroups(mine))) {
    clashes.push('groups');
  }
  return clashes;
}

function sortedGroups(card: ICardState): readonly string[] {
  return [...card.groupIds].sort();
}

/** Memberships merge as sets from the base; with no base to tell an addition from a removal, they are a question. */
function combineGroups(
  base: TAncestor,
  theirs: ICardState,
  mine: ICardState,
  choice: TCombineSide | undefined
): ICardState['groupIds'] {
  if (isNil(base)) {
    return sideOf(NO_ANCESTOR, sortedGroups(theirs), sortedGroups(mine), choice) === 'mine'
      ? mine.groupIds
      : theirs.groupIds;
  }
  const removed = new Set(
    [...(base?.groupIds ?? [])].filter(
      id => !theirs.groupIds.includes(id) || !mine.groupIds.includes(id)
    )
  );
  return uniq([...theirs.groupIds, ...mine.groupIds]).filter(id => !removed.has(id));
}

function combineTabs(
  base: TAncestor,
  theirs: ICardState,
  mine: ICardState,
  fields: ReadonlyMap<TFieldId, ICardField>,
  choice: TCombineSide | undefined
): ICardState['tabs'] {
  const common = new Set(
    fieldIds(theirs).filter(id => allFields(mine).some(field => field.id === id))
  );
  const layoutFrom =
    sideOf(layoutOf(base, common), tabLayout(theirs, common), tabLayout(mine, common), choice) ===
    'mine'
      ? mine
      : theirs;
  const placed = new Set<TFieldId>();
  const tabFields = new Map<string, ICardField[]>(layoutFrom.tabs.map(tab => [tab.id, []]));
  for (const tab of layoutFrom.tabs) {
    for (const field of tab.fields) {
      const resolved = fields.get(field.id);
      if (!isNil(resolved)) {
        tabFields.get(tab.id)?.push(resolved);
        placed.add(field.id);
      }
    }
  }
  for (const [id, field] of fields) {
    if (!placed.has(id)) {
      const home = [mine, theirs]
        .map(side => side.tabs.find(tab => tab.fields.some(candidate => candidate.id === id))?.id)
        .find(tabId => !isNil(tabId) && tabFields.has(tabId));
      (tabFields.get(home ?? layoutFrom.tabs[0].id) ?? []).push(field);
    }
  }
  const [first, ...rest] = layoutFrom.tabs.map((tab): ICardTab => ({
    ...tab,
    fields: tabFields.get(tab.id) ?? [],
  }));
  return [first, ...rest];
}

/**
 * Mine and theirs, both made from base, into one card: every
 * change made on one side only is kept, and an aspect changed differently on
 * both goes by `choices` (theirs by default, the fresher version).
 */
export function combineCardChanges(
  base: ICardState | null,
  theirs: ICardState,
  mine: ICardState,
  choices: TCombineChoices
): ICardState {
  const [baseFields, theirFields, myFields] = [
    fieldsById(base),
    fieldsById(theirs),
    fieldsById(mine),
  ];
  const fields = new Map<TFieldId, ICardField>();
  for (const id of fieldIds(base, theirs, mine)) {
    const field = pick(
      baseFieldOf(base, baseFields, id),
      theirFields.get(id),
      myFields.get(id),
      choices.get(`field:${id}`)
    );
    if (!isNil(field)) {
      fields.set(id, field);
    }
  }
  const withValues = VALUE_ASPECTS.reduce(
    (card, row) => row.resolve(base, theirs, mine, choices.get(row.aspect), card),
    theirs
  );
  return {
    ...withValues,
    groupIds: combineGroups(base, theirs, mine, choices.get('groups')),
    tabs: combineTabs(base, theirs, mine, fields, choices.get('tabs')),
  };
}
