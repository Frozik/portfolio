import * as fc from 'fast-check';
import { Temporal } from 'temporal-polyfill';

import { aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import type { IVaultCard } from './card';
import { classifyCards, membersOf, possibleDuplicates } from './classify-cards';
import { expiryStatus, warningDaysFor } from './expiry';
import { liveGroupIds } from './group-edits';
import type { TGroupId, TTemplateId } from './ids';
import { BUILTIN_GROUP_IDS, BUILTIN_SMART_GROUPS, evaluateRule } from './smart-groups';
import type { IUserGroup } from './vault-document';

const today = Temporal.PlainDate.from('2026-10-11');
const WORK = 'group-work' as TGroupId;
const HOME = 'group-home' as TGroupId;
const DELETED = 'group-deleted' as TGroupId;
const groups = new Map<TGroupId, IUserGroup>(
  [WORK, HOME].map((id, order) => [
    id,
    { id, name: id, icon: null, color: null, order, updatedAt: anHlc(1) },
  ])
);

const cardArbitrary = fc
  .record({
    favorite: fc.boolean(),
    protected: fc.boolean(),
    archived: fc.boolean(),
    trashed: fc.boolean(),
    template: fc.constantFrom('bank-card', 'internet-account', 'document'),
    otp: fc.boolean(),
    expiry: fc.option(fc.constantFrom('2026-09', '2026-10', '2026-11', '2027-06'), { nil: null }),
    groups: fc.subarray([WORK, HOME, DELETED]),
  })
  .map((shape): IVaultCard =>
    aCardWith(
      [
        ...(shape.otp ? [aField({ kind: 'otp' }, 'otpauth://totp/x?secret=JBSWY3DP')] : []),
        ...(shape.expiry === null ? [] : [aField({ kind: 'expiry-month' }, shape.expiry)]),
      ],
      {
        favorite: shape.favorite,
        protected: shape.protected,
        archivedAt: shape.archived ? anHlc(2) : null,
        trashedAt: shape.trashed ? anHlc(3) : null,
        templateId: shape.template as TTemplateId,
        groupIds: shape.groups,
      }
    )
  );

describe('classifying cards', () => {
  it('puts every card in the same groups one pass at a time as the rules do one by one', () => {
    fc.assert(
      fc.property(fc.array(cardArbitrary, { maxLength: 30 }), cards => {
        const document = aDocument(cards, { groups });
        const classification = classifyCards(document, today);
        const duplicates = possibleDuplicates(document);
        return BUILTIN_GROUP_IDS.every(group => {
          const expected = cards.filter(card =>
            evaluateRule(BUILTIN_SMART_GROUPS[group], card, {
              expiry: expiryStatus(card, today, warningDaysFor(card, document.settings)),
              groupIds: liveGroupIds(document, card.groupIds),
              auditProblem: false,
              possibleDuplicate: duplicates.has(card.id),
            })
          );
          return JSON.stringify(membersOf(classification, group)) === JSON.stringify(expected);
        });
      }),
      { seed: 20261011, numRuns: 60 }
    );
  });

  it('shows archived and trashed cards only in the archive and the trash', () => {
    const archived = aCardWith([], { archivedAt: anHlc(2), favorite: true, groupIds: [WORK] });
    const trashed = aCardWith([], { trashedAt: anHlc(3), archivedAt: anHlc(2) });
    const classification = classifyCards(aDocument([archived, trashed], { groups }), today);

    expect(membersOf(classification, 'all')).toEqual([]);
    expect(membersOf(classification, 'favorites')).toEqual([]);
    expect(membersOf(classification, WORK)).toEqual([]);
    expect(membersOf(classification, 'archive')).toEqual([archived]);
    expect(membersOf(classification, 'trash')).toEqual([trashed]);
  });

  it('files active cards under their live user groups only, and the rest under "no group"', () => {
    const inWork = aCardWith([], { groupIds: [WORK, DELETED] });
    const orphan = aCardWith([], { groupIds: [DELETED] });
    const classification = classifyCards(aDocument([inWork, orphan], { groups }), today);

    expect(membersOf(classification, WORK)).toEqual([inWork]);
    expect(membersOf(classification, DELETED)).toEqual([]);
    expect(membersOf(classification, 'no-group')).toEqual([orphan]);
  });

  it('separates cards expiring soon from expired ones', () => {
    const soon = aCardWith([aField({ kind: 'expiry-month' }, '2026-10')]);
    const expired = aCardWith([aField({ kind: 'expiry-month' }, '2026-09')]);
    const classification = classifyCards(aDocument([soon, expired]), today);

    expect(membersOf(classification, 'expiring')).toEqual([soon]);
    expect(membersOf(classification, 'expired')).toEqual([expired]);
  });
});
