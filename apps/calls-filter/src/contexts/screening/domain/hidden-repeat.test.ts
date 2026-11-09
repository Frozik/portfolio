import { assert } from '@frozik/utils/assert/assert';

import type { TGroupId } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import { findGroup } from '../../grouping/domain/group-book';
import {
  bookOf,
  custom,
  NETHERLANDS_HOME,
  NOW,
  numberMask,
  special,
  STRANGERS_ID,
} from '../../grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK } from '../../policy/domain/policy';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { REPEAT_OFF } from '../../policy/domain/repeat-pass';
import { hiddenCallsMissRepeat } from './hidden-repeat';

const ALWAYS: TRepeatPass = { kind: 'always' };
const REPEATING = { ...ALWAYS_BLOCK, repeatPass: ALWAYS };

const warns = (book: GroupBook, id: string, filterRepeat: TRepeatPass = REPEAT_OFF) => {
  const group = findGroup(book, id as TGroupId);
  assert(group !== null, `no group ${id}`);
  return hiddenCallsMissRepeat(book, group, NETHERLANDS_HOME, filterRepeat, NOW);
};

describe('a hidden number cannot prove a repeat', () => {
  it('warns a group that takes hidden numbers and lets a repeat ring', () => {
    const book = bookOf([custom('spam', [special('hidden')], { policy: REPEATING })]);
    expect(warns(book, 'spam')).toBe(true);
  });

  it('warns «Strangers» when no group takes hidden numbers and the filter-wide repeat is on', () => {
    const book = bookOf([custom('spam', [numberMask('+3185*')])]);
    expect(warns(book, STRANGERS_ID, ALWAYS)).toBe(true);
  });

  it('stays quiet where hidden numbers never land', () => {
    const book = bookOf([
      custom('spam', [special('hidden')]),
      custom('work', [numberMask('+3120*')], { policy: REPEATING }),
    ]);
    expect(warns(book, 'work')).toBe(false);
  });

  it('stays quiet while a repeat does not ring', () => {
    const book = bookOf([custom('spam', [special('hidden')])]);
    expect(warns(book, 'spam')).toBe(false);
  });
});
