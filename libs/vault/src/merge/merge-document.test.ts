import { assert } from '@frozik/utils/assert/assert';
import * as fc from 'fast-check';

import type { IVaultCard } from '../model/card';
import type { IHlc } from '../model/hlc';
import { compareHlc } from '../model/hlc';
import { advanceHotpCounter, hotpCounterKey, hotpCounterOf } from '../model/hotp-counters';
import type { TTemplateId } from '../model/ids';
import type { TCardId, TFieldId, TGroupId, TLinkId, TTabId } from '../model/ids';
import { linkCards, linkedCardIds, linkIdOf } from '../model/link-edits';
import { purgeCard } from '../model/purge-card';
import { cardState, trimHistory } from '../model/revision-edits';
import type { TSmartGroupRule } from '../model/smart-group-rule';
import type { IVaultDocument, THotpCounterKey, TTombstoneKey } from '../model/vault-document';
import { aCardWith, aDocument, aField } from '../testing/builders';
import { mergeDocument } from './merge-document';

const PROPERTY_SEED = 20261011;
const CARD_IDS = ['card-1', 'card-2', 'card-3'] as TCardId[];
const GROUP_IDS = ['group-1', 'group-2'] as TGroupId[];
const TEMPLATE_IDS = ['user-a', 'user-b'] as TTemplateId[];
const SMART_GROUP_IDS = ['smart-a', 'smart-b'] as TGroupId[];

const stamp = fc.record({
  wallMs: fc.constantFrom(1000, 2000, 3000, 4000),
  counter: fc.constantFrom(0, 1),
  node: fc.constantFrom('a:1', 'b:1'),
});

/**
 * Documents that edits can produce: one stamp is one version (the title
 * follows from the stamp), and history holds older versions, one per stamp.
 */
const card = fc
  .record({
    id: fc.constantFrom(...CARD_IDS),
    updatedAt: stamp,
    historyStamps: fc.uniqueArray(stamp, {
      selector: value => `${value.wallMs}/${value.counter}/${value.node}`,
      maxLength: 2,
    }),
  })
  .map(({ id, updatedAt, historyStamps }): IVaultCard => {
    const versionAt = (at: IHlc): IVaultCard => {
      const version = aCardWith(
        [
          aField({ kind: 'otp' }, 'otpauth://hotp/x?secret=JBSWY3DP', {
            id: `${id}-otp` as TFieldId,
          }),
        ],
        {
          id,
          title: `${id} @ ${at.wallMs}/${at.counter}/${at.node}`,
          favorite: at.counter === 1,
          updatedAt: at,
          createdAt: { wallMs: 0, counter: 0, node: 'a:1' },
        }
      );
      const [tab] = version.tabs;
      return { ...version, tabs: [{ ...tab, id: `${id}-tab` as TTabId }] };
    };
    const current = versionAt(updatedAt);
    const older = historyStamps.filter(at => compareHlc(at, updatedAt) < 0);
    return {
      ...current,
      history: trimHistory(older.map(at => ({ at, snapshot: cardState(versionAt(at)) }))),
    };
  });

const tombstoneKey = fc.constantFrom<TTombstoneKey>(
  ...CARD_IDS.map(id => `card:${id}` as const),
  `link:${linkIdOf(CARD_IDS[0] ?? ('' as TCardId), CARD_IDS[1] ?? ('' as TCardId))}` as const,
  ...GROUP_IDS.map(id => `group:${id}` as const),
  ...TEMPLATE_IDS.map(id => `template:${id}` as const),
  ...SMART_GROUP_IDS.map(id => `group:${id}` as const)
);

const documentArbitrary: fc.Arbitrary<IVaultDocument> = fc
  .record({
    cards: fc.uniqueArray(card, { selector: value => value.id, maxLength: 3 }),
    tombstones: fc.array(fc.tuple(tombstoneKey, stamp), { maxLength: 3 }),
    groups: fc.uniqueArray(
      fc.record({
        id: fc.constantFrom(...GROUP_IDS),
        name: fc.constantFrom('Work', 'Home'),
        updatedAt: stamp,
      }),
      {
        selector: value => value.id,
        maxLength: 2,
      }
    ),
    templates: fc.uniqueArray(
      fc.record({
        id: fc.constantFrom(...TEMPLATE_IDS),
        name: fc.constantFrom('Locker', 'Alarm'),
        updatedAt: stamp,
      }),
      { selector: value => value.id, maxLength: 2 }
    ),
    smartGroups: fc.uniqueArray(
      fc.record({
        id: fc.constantFrom(...SMART_GROUP_IDS),
        name: fc.constantFrom('Codes', 'Old'),
        rule: fc.constantFrom<TSmartGroupRule>({ kind: 'favorite' }, { kind: 'protected' }),
        updatedAt: stamp,
      }),
      { selector: value => value.id, maxLength: 2 }
    ),
    linkCreatedAt: fc.option(stamp, { nil: null }),
    hotp: fc.array(fc.tuple(fc.constantFrom(...CARD_IDS), fc.nat(9)), { maxLength: 3 }),
    settingsAt: stamp,
    name: fc.constantFrom('Vault', 'Mine'),
  })
  .map(
    ({
      cards,
      tombstones,
      groups,
      templates,
      smartGroups,
      linkCreatedAt,
      hotp,
      settingsAt,
      name,
    }) => {
      const [first, second] = CARD_IDS;
      assert(first !== undefined && second !== undefined);
      const linkId: TLinkId = linkIdOf(first, second);
      return aDocument(cards, {
        settings: { name, expiryWarningDays: {}, providerHint: null, updatedAt: settingsAt },
        tombstones: tombstones.reduce(
          (map, [key, at]) =>
            map.set(key, (map.get(key)?.wallMs ?? -1) > at.wallMs ? (map.get(key) ?? at) : at),
          new Map<TTombstoneKey, IHlc>()
        ),
        groups: new Map(
          groups.map(group => [group.id, { ...group, icon: null, color: null, order: 0 }])
        ),
        smartGroups: new Map(smartGroups.map(group => [group.id, group])),
        templates: new Map(
          templates.map(template => [
            template.id,
            { ...template, icon: 'key' as const, tabs: [{ title: null, fields: [] }] },
          ])
        ),
        hotpCounters: hotp.reduce(
          (map, [cardId, counter]) =>
            map.set(
              hotpCounterKey(cardId, 'otp' as TFieldId),
              Math.max(map.get(hotpCounterKey(cardId, 'otp' as TFieldId)) ?? 0, counter)
            ),
          new Map<THotpCounterKey, number>()
        ),
        links:
          linkCreatedAt === null
            ? new Map()
            : new Map([
                [
                  linkId,
                  {
                    id: linkId,
                    a: first < second ? first : second,
                    b: first < second ? second : first,
                    createdAt: linkCreatedAt,
                  },
                ],
              ]),
      });
    }
  );

describe('merge laws', () => {
  it('is commutative', () => {
    fc.assert(
      fc.property(documentArbitrary, documentArbitrary, (first, second) => {
        expect(mergeDocument(first, second)).toEqual(mergeDocument(second, first));
      }),
      { seed: PROPERTY_SEED, numRuns: 200 }
    );
  });

  it('is associative', () => {
    fc.assert(
      fc.property(
        documentArbitrary,
        documentArbitrary,
        documentArbitrary,
        (first, second, third) => {
          expect(mergeDocument(mergeDocument(first, second), third)).toEqual(
            mergeDocument(first, mergeDocument(second, third))
          );
        }
      ),
      { seed: PROPERTY_SEED, numRuns: 200 }
    );
  });

  it('is idempotent, and merging an input again changes nothing', () => {
    fc.assert(
      fc.property(documentArbitrary, documentArbitrary, (first, second) => {
        const merged = mergeDocument(first, second);
        expect(mergeDocument(merged, merged)).toEqual(merged);
        expect(mergeDocument(merged, first)).toEqual(merged);
      }),
      { seed: PROPERTY_SEED, numRuns: 200 }
    );
  });
});

describe('merge rules', () => {
  const at = (wallMs: number, node = 'a:1'): IHlc => ({ wallMs, counter: 0, node });
  const bank = aCardWith([], { id: 'card-bank' as TCardId, title: 'Bank', updatedAt: at(10) });

  it('keeps the later version of a card and the other one in its history', () => {
    const mine = { ...bank, title: 'Bank (mine)', updatedAt: at(20, 'a:1') };
    const theirs = { ...bank, title: 'Bank (theirs)', updatedAt: at(30, 'b:1') };

    const merged = mergeDocument(aDocument([mine]), aDocument([theirs])).cards.get(bank.id);

    expect(merged?.title).toBe('Bank (theirs)');
    expect(merged?.history.map(revision => revision.snapshot.title)).toEqual(['Bank (mine)']);
  });

  it('deletes a card the other device edited earlier, and keeps one it edited later', () => {
    const deleted = purgeCard(aDocument([bank]), bank.id, at(20));

    expect(
      mergeDocument(deleted, aDocument([{ ...bank, updatedAt: at(15) }])).cards.has(bank.id)
    ).toBe(false);
    expect(
      mergeDocument(deleted, aDocument([{ ...bank, updatedAt: at(25) }])).cards.has(bank.id)
    ).toBe(true);
  });

  it('brings a card back with the links that were deleted together with it', () => {
    const other = aCardWith([], { id: 'card-other' as TCardId, updatedAt: at(10) });
    const linked = linkCards(aDocument([bank, other]), bank.id, other.id, at(12));
    assert(linked.ok);
    const deletedHere = purgeCard(linked.value, bank.id, at(20));
    const editedThere = {
      ...linked.value,
      cards: new Map(linked.value.cards).set(bank.id, {
        ...bank,
        title: 'Edited',
        updatedAt: at(30, 'b:1'),
      }),
    };

    const merged = mergeDocument(deletedHere, editedThere);

    expect(merged.cards.get(bank.id)?.title).toBe('Edited');
    expect(linkedCardIds(merged, bank.id)).toEqual([other.id]);
  });

  it('never lets a HOTP counter go back', () => {
    const fieldId = 'otp' as TFieldId;
    const usedTwice = advanceHotpCounter(
      advanceHotpCounter(aDocument([bank]), bank.id, fieldId, 0),
      bank.id,
      fieldId,
      0
    );
    const usedOnce = advanceHotpCounter(aDocument([bank]), bank.id, fieldId, 0);

    const merged = mergeDocument(usedTwice, usedOnce);

    expect(hotpCounterOf(merged, bank.id, fieldId, 0)).toBe(2);
  });

  it('leaves the cards of a deleted group alone', () => {
    const member = { ...bank, groupIds: ['group-1' as TGroupId] };
    const withGroup = aDocument([member], {
      groups: new Map([
        [
          'group-1' as TGroupId,
          {
            id: 'group-1' as TGroupId,
            name: 'Work',
            icon: null,
            color: null,
            order: 0,
            updatedAt: at(5),
          },
        ],
      ]),
    });
    const groupDeleted = {
      ...withGroup,
      groups: new Map(),
      tombstones: new Map<TTombstoneKey, IHlc>([['group:group-1' as TTombstoneKey, at(6)]]),
    };

    const merged = mergeDocument(withGroup, groupDeleted);

    expect(merged.groups.size).toBe(0);
    expect(merged.cards.get(bank.id)).toEqual(member);
  });
});
