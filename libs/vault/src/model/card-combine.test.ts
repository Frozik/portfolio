import { aCardWith, aField, aTab } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import type { ICardState } from './card';
import { allFields } from './card';
import type { TCombineAspect, TCombineSide } from './card-combine';
import { combineCardChanges, combineClashes } from './card-combine';
import { diffCardStates } from './card-diff';
import { addField, setFieldValue } from './field-edits';
import type { TGroupId } from './ids';
import { cardState } from './revision-edits';

const login = aField({ kind: 'login' }, 'jane');
const pin = aField({ kind: 'pin' }, '0420', { sensitive: true });
const base: ICardState = cardState(aCardWith([login, pin], { title: 'Bank' }));
const value = (card: ICardState, id: string): unknown =>
  allFields(card).find(field => field.id === id)?.value;

describe('combining two versions of a card', () => {
  it('keeps every change made on one side only', () => {
    const theirs = setFieldValue(base, pin.id, { cardinality: 'single', value: '1111' });
    const mine = {
      ...setFieldValue(base, login.id, { cardinality: 'single', value: 'jane.doe' }),
      favorite: true,
    };

    const combined = combineCardChanges(base, theirs, mine, new Map());

    expect(combineClashes(base, theirs, mine)).toEqual([]);
    expect(value(combined, pin.id)).toEqual({ cardinality: 'single', value: '1111' });
    expect(value(combined, login.id)).toEqual({ cardinality: 'single', value: 'jane.doe' });
    expect(combined.favorite).toBe(true);
  });

  it('asks about a field both sides changed differently, and takes the fresher one unless told', () => {
    const theirs = {
      ...setFieldValue(base, pin.id, { cardinality: 'single', value: '1111' }),
      title: 'Their bank',
    };
    const mine = {
      ...setFieldValue(base, pin.id, { cardinality: 'single', value: '2222' }),
      title: 'My bank',
    };

    expect(combineClashes(base, theirs, mine)).toEqual(['title', `field:${pin.id}`]);
    expect(value(combineCardChanges(base, theirs, mine, new Map()), pin.id)).toEqual({
      cardinality: 'single',
      value: '1111',
    });
    const chosen = combineCardChanges(
      base,
      theirs,
      mine,
      new Map<TCombineAspect, TCombineSide>([[`field:${pin.id}`, 'mine']])
    );
    expect(value(chosen, pin.id)).toEqual({ cardinality: 'single', value: '2222' });
    expect(chosen.title).toBe('Their bank');
  });

  it('keeps fields added on either side and drops one removed on a side the other did not touch', () => {
    const random = createSeededRandom(4);
    const theirs = addField(
      base,
      base.tabs[0].id,
      { kind: 'email', label: 'Email', cardinality: 'single' },
      random
    ).card;
    const mine = { ...base, tabs: [aTab([login])] as ICardState['tabs'] };
    const mineInSameTab = {
      ...mine,
      tabs: [{ ...base.tabs[0], fields: [login] }] as ICardState['tabs'],
    };

    const combined = combineCardChanges(base, theirs, mineInSameTab, new Map());

    expect(allFields(combined).map(field => field.spec.kind)).toEqual(['login', 'email']);
  });

  it('asks, with no common ancestor, about a field one side has and the other not, and about groups', () => {
    const theirs = {
      ...base,
      tabs: [{ ...base.tabs[0], fields: [login] }] as ICardState['tabs'],
      groupIds: ['work' as TGroupId],
    };
    const mine = { ...base, groupIds: ['home' as TGroupId] };

    expect(combineClashes(null, theirs, mine)).toEqual([`field:${pin.id}`, 'groups']);
    expect(
      allFields(combineCardChanges(null, theirs, mine, new Map())).map(field => field.id)
    ).toEqual([login.id]);
    expect(
      combineCardChanges(
        null,
        theirs,
        mine,
        new Map<TCombineAspect, TCombineSide>([['groups', 'mine']])
      ).groupIds
    ).toEqual(['home']);
  });

  it('treats every difference as a question when no common ancestor is left', () => {
    const theirs = { ...base, title: 'A', favorite: true };
    const mine = { ...base, title: 'B', favorite: true };

    expect(combineClashes(null, theirs, mine)).toEqual(['title']);
    expect(
      combineCardChanges(
        null,
        theirs,
        mine,
        new Map<TCombineAspect, TCombineSide>([['title', 'mine']])
      ).title
    ).toBe('B');
  });
});

describe('card differences', () => {
  it('list what turned one version into another', () => {
    const after = {
      ...setFieldValue(base, pin.id, { cardinality: 'single', value: '9999' }),
      title: 'Renamed',
      favorite: true,
    };

    expect(diffCardStates(base, after).map(change => change.kind)).toEqual([
      'title',
      'field-changed',
      'flag',
    ]);
    expect(diffCardStates(base, base)).toEqual([]);
  });

  it('report an added field once, not as a layout change too', () => {
    const after = addField(
      base,
      base.tabs[0].id,
      { kind: 'email', label: 'Email', cardinality: 'single' },
      createSeededRandom(5)
    ).card;

    expect(diffCardStates(base, after).map(change => change.kind)).toEqual(['field-added']);
  });
});
