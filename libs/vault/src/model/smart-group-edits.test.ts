import { Temporal } from 'temporal-polyfill';

import { decodeDocument, encodeDocument } from '../format/document-codec';
import { mergeDocument } from '../merge/merge-document';
import { aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { classifyCards, membersOf } from './classify-cards';
import { createSmartGroup, deleteSmartGroup, updateSmartGroup } from './smart-group-edits';
import type { TSmartGroupRule } from './smart-group-rule';

const TODAY = Temporal.PlainDate.from('2026-10-12');
const WITH_OTP_NOT_FAVORITE: TSmartGroupRule = {
  kind: 'all',
  rules: [
    { kind: 'has-field', fieldKind: 'otp' },
    { kind: 'not', rule: { kind: 'favorite' } },
  ],
};

function cards() {
  const otp = aField({ kind: 'otp' }, 'otpauth://totp/x?secret=JBSWY3DP');
  return {
    plain: aCardWith([otp], { title: 'Plain' }),
    favorite: aCardWith([otp], { title: 'Favorite', favorite: true }),
    archived: aCardWith([otp], { title: 'Archived', archivedAt: anHlc(1) }),
    none: aCardWith([], { title: 'None' }),
  };
}

describe('smart groups of the user’s own', () => {
  it('hold the active cards their rule matches, counted in the same pass as the built-in ones', () => {
    const { plain, favorite, archived, none } = cards();
    const { document, groupId } = createSmartGroup(
      aDocument([plain, favorite, archived, none]),
      ' Codes to review ',
      WITH_OTP_NOT_FAVORITE,
      anHlc(2),
      createSeededRandom(1)
    );

    const members = membersOf(classifyCards(document, TODAY), groupId);

    expect(document.smartGroups.get(groupId)?.name).toBe('Codes to review');
    expect(members.map(card => card.title)).toEqual(['Plain']);
  });

  it('reach into the archive when their rule asks about it', () => {
    const { plain, archived } = cards();
    const { document, groupId } = createSmartGroup(
      aDocument([plain, archived]),
      'Archived codes',
      { kind: 'all', rules: [{ kind: 'archived' }, { kind: 'has-field', fieldKind: 'otp' }] },
      anHlc(2),
      createSeededRandom(1)
    );

    expect(membersOf(classifyCards(document, TODAY), groupId).map(card => card.title)).toEqual([
      'Archived',
    ]);
  });

  it('change name and rule together, are deleted for good, and are written and read back', () => {
    const created = createSmartGroup(
      aDocument(),
      'Codes',
      WITH_OTP_NOT_FAVORITE,
      anHlc(2),
      createSeededRandom(1)
    );
    const updated = updateSmartGroup(
      created.document,
      created.groupId,
      { name: 'Favorites', rule: { kind: 'favorite' } },
      anHlc(3)
    );
    const deleted = deleteSmartGroup(updated, created.groupId, anHlc(4));
    const decoded = decodeDocument(
      new Map(encodeDocument(updated).map(entry => [entry.path, entry.bytes]))
    );

    expect(updated.smartGroups.get(created.groupId)).toMatchObject({
      name: 'Favorites',
      rule: { kind: 'favorite' },
    });
    expect(mergeDocument(updated, deleted).smartGroups.size).toBe(0);
    expect(decoded.ok && decoded.value.smartGroups).toEqual(updated.smartGroups);
  });
});
