import {
  bookOf,
  contact,
  custom,
  factsWith,
  MY_CONTACTS_ID,
  nameMask,
  newMemberId,
  NOW,
  numberMask,
  pickedContact,
  special,
  stranger,
} from '../testing/group-book-fixtures';
import { detectConflicts } from './conflict-detection';
import type { IConflictFacts } from './conflict-detection';
import { resolutionsFor } from './conflict-resolutions';
import type { GroupBook } from './group-book';
import { applyChanges } from './group-changes';
import { membership } from './membership';

function conflictGroups(book: GroupBook, facts: IConflictFacts = factsWith()): readonly string[] {
  return detectConflicts(book, facts).map(conflict => conflict.groups.join('+'));
}

describe('conflicts between groups', () => {
  it('finds two masks that take the same numbers, with an example number', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')]),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    const [conflict] = detectConflicts(book, factsWith());
    expect(conflict?.groups).toEqual(['spam', 'delivery']);
    expect(conflict?.example.kind === 'number' && conflict.example.digits.startsWith('74951')).toBe(
      true
    );
  });

  it('finds none once the overlap is excluded from one side', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')], { exclude: [numberMask('+7 495 1*')] }),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    expect(conflictGroups(book)).toEqual([]);
  });

  it('finds name masks over the same name that overlap', () => {
    const book = bookOf([
      custom('a', [nameMask('courier*', 'network')]),
      custom('b', [nameMask('*delivery*', 'network')]),
    ]);
    expect(conflictGroups(book)).toEqual(['a+b']);
  });

  it('does not compare a mask over operator names with one over contact names by their text alone', () => {
    const book = bookOf([
      custom('a', [nameMask('courier*', 'network')]),
      custom('b', [nameMask('courier*', 'contact')]),
    ]);
    expect(conflictGroups(book)).toEqual([]);
  });

  it('finds a known caller whose operator name and contact name land in different groups', () => {
    const book = bookOf(
      [
        custom('a', [nameMask('ozon*', 'network')], { excludeMyContacts: false }),
        custom('b', [nameMask('courier*', 'contact')]),
      ],
      [nameMask('*', 'contact')]
    );
    const caller = {
      ...contact('Courier Ozon', '31612345000'),
      networkName: 'ozon dostavka' as never,
    };
    expect(conflictGroups(book, factsWith([caller]))).toEqual(['a+b']);
  });

  it('finds a picked contact still in «my contacts»', () => {
    const book = bookOf([custom('family', [pickedContact('Mum', '31612345678')])]);
    expect(conflictGroups(book)).toEqual([`family+${MY_CONTACTS_ID}`]);
  });

  it('flags the same special mask in two groups before any such call was seen', () => {
    const book = bookOf([
      custom('spam', [special('premium-rate')]),
      custom('work', [numberMask('+31 20*'), special('premium-rate')]),
    ]);
    const [conflict] = detectConflicts(book, factsWith());
    expect(conflict?.groups).toEqual(['spam', 'work']);
    expect(conflict?.example).toEqual({ kind: 'special', special: 'premium-rate' });
  });

  it('resolves a shared special mask by switching it off in the other group and excluding it there', () => {
    const book = bookOf([
      custom('spam', [special('hidden')]),
      custom('night', [special('hidden'), numberMask('+31 85*')]),
    ]);
    const [conflict] = detectConflicts(book, factsWith());
    if (conflict === undefined) {
      throw new Error('a conflict is expected');
    }
    const [keepInSpam] = resolutionsFor(book, conflict, { newMemberId, now: NOW });
    const resolved = applyChanges(book, keepInSpam?.changes ?? [], NOW).book;
    expect(detectConflicts(resolved, factsWith())).toEqual([]);
    const night = resolved.groups.find(group => group.id === 'night');
    expect(night?.kind === 'custom' && night.include.map(member => member.kind)).toEqual([
      'number-mask',
    ]);
    expect(
      night?.kind === 'custom' &&
        night.exclude.map(member => (member.kind === 'special' ? member.special : member.kind))
    ).toEqual(['hidden']);
  });

  it('checks special masks against the callers already seen', () => {
    const book = bookOf([
      custom('hidden', [special('hidden')]),
      custom('all', [numberMask('*'), special('hidden')]),
    ]);
    const hidden = { number: null, traits: null, networkName: null, contact: null };
    expect(conflictGroups(book, factsWith([hidden]))).toContain('hidden+all');
  });

  it('ignores a contact picked by hand where the other group drops contacts', () => {
    const book = bookOf(
      [
        custom('family', [pickedContact('Mum', '31612345678')]),
        custom('mobiles', [numberMask('+31 6*')]),
      ],
      [pickedContact('Mum', '31612345678')]
    );
    expect(conflictGroups(book)).toEqual([]);
  });
});

describe('resolving a conflict', () => {
  const context = { newMemberId, now: NOW };

  it('keeps the callers in the chosen group by excluding its mask from the other', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')]),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    const [conflict] = detectConflicts(book, factsWith());
    if (conflict === undefined) {
      throw new Error('expected a conflict');
    }
    const keepInDelivery = resolutionsFor(book, conflict, context).find(
      resolution => resolution.winner === 'delivery'
    );
    const resolved = applyChanges(book, keepInDelivery?.changes ?? [], NOW).book;
    expect(conflictGroups(resolved)).toEqual([]);
    const found = membership(resolved, stranger('74951000000'), factsWith().environment);
    expect(found.kind === 'one' && found.group.id).toBe('delivery');
    expect(membership(resolved, stranger('74952000000'), factsWith().environment)).toMatchObject({
      kind: 'one',
      group: { id: 'spam' },
    });
  });

  it('keeps a picked contact in its group by excluding it from «my contacts»', () => {
    const book = bookOf([custom('family', [pickedContact('Mum', '31612345678')])]);
    const [conflict] = detectConflicts(book, factsWith());
    if (conflict === undefined) {
      throw new Error('expected a conflict');
    }
    const keepInFamily = resolutionsFor(book, conflict, context).find(
      resolution => resolution.winner === 'family'
    );
    const resolved = applyChanges(book, keepInFamily?.changes ?? [], NOW).book;
    expect(conflictGroups(resolved)).toEqual([]);
  });

  it('keeps contacts in «my contacts» by switching the other group to exclude them', () => {
    const book = bookOf([
      custom('work', [numberMask('+31 20 555 ....')], { excludeMyContacts: false }),
    ]);
    const colleague = contact('Colleague', '31205551234');
    const [conflict] = detectConflicts(book, factsWith([colleague]));
    if (conflict === undefined) {
      throw new Error('expected a conflict');
    }
    const keepInContacts = resolutionsFor(book, conflict, context).find(
      resolution => resolution.winner === MY_CONTACTS_ID
    );
    expect(keepInContacts?.changes).toEqual([{ kind: 'exclude-my-contacts', group: 'work' }]);
  });

  it('offers to settle only the known callers', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')]),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    const known = stranger('74951234567');
    const [conflict] = detectConflicts(book, factsWith([known]));
    if (conflict === undefined) {
      throw new Error('expected a conflict');
    }
    const onlyKnown = resolutionsFor(book, conflict, context).find(
      resolution => resolution.kind === 'keep-known-callers-in' && resolution.winner === 'delivery'
    );
    const resolved = applyChanges(book, onlyKnown?.changes ?? [], NOW).book;
    expect(membership(resolved, known, factsWith().environment)).toMatchObject({
      kind: 'one',
      group: { id: 'delivery' },
    });
    expect(conflictGroups(resolved)).toEqual(['spam+delivery']);
  });
});
