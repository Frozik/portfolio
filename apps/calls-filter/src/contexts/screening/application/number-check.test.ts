import { SCENARIO_INPUTS } from '../../../fixtures/scenario-world';
import type { TGroupId } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import {
  bookOf,
  contact,
  custom,
  MY_CONTACTS_ID,
  NETHERLANDS_HOME,
  NOW,
  numberMask,
  special,
  stranger,
} from '../../grouping/testing/group-book-fixtures';
import type { IJournalEntry, TJournalEntryId } from '../../journal/domain/journal-entry';
import type { TE164Digits } from '../../phone/domain/caller';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import { floatingMinute } from '../../policy/domain/floating-time';
import { NOWHERE_KNOWN } from '../../policy/domain/place-rule';
import { ALWAYS_BLOCK } from '../../policy/domain/policy';
import { REPEAT_OFF } from '../../policy/domain/repeat-pass';
import type { INumberCheckContext, INumberQuery } from './number-check';
import { checkNumber } from './number-check';

const INTERNATIONAL = /^\+(\d{8,15})$/;

/** Numbers written internationally only: enough for the rules, without the world's plan. */
const NUMBERING: IPhoneNumbering = {
  region: () => null,
  parse: raw => {
    const digits = INTERNATIONAL.exec(raw.replaceAll(' ', ''))?.[1];
    return digits === undefined ? null : (digits as TE164Digits);
  },
  traits: () => ({ country: 'NL' as TCountryCode, type: 'mobile' }),
  format: digits => `+${digits}`,
};

const SPAM = custom('spam', [numberMask('+3185*'), special('hidden')], {
  policy: { ...ALWAYS_BLOCK, repeatPass: { kind: 'always' } },
});

function contextOf(book: GroupBook, overrides: Partial<INumberCheckContext> = {}) {
  return {
    book,
    environment: NETHERLANDS_HOME,
    inputs: SCENARIO_INPUTS,
    paused: false,
    repeatPass: REPEAT_OFF,
    atPlace: NOWHERE_KNOWN,
    moment: {
      instant: NOW,
      local: floatingMinute(NOW.toZonedDateTimeISO('Europe/Amsterdam').toPlainDateTime()),
    },
    numbering: NUMBERING,
    knownCallers: [],
    journal: [],
    ...overrides,
  } satisfies INumberCheckContext;
}

const query = (number: string, extra: Partial<INumberQuery> = {}): INumberQuery => ({
  number,
  networkName: '',
  hidden: false,
  ...extra,
});

function verdictOf(found: ReturnType<typeof checkNumber>) {
  return found.kind === 'decided'
    ? { group: found.decision.group.id, verdict: found.decision.verdict }
    : found;
}

describe('checking a number: the answer the service would give now', () => {
  it('puts a number into the group whose mask takes it, with that group’s answer', () => {
    const found = checkNumber(query('+31 85 123 4567'), contextOf(bookOf([SPAM])));
    expect(verdictOf(found)).toEqual({ group: 'spam', verdict: 'awaiting-repeat' });
  });

  it('lets the second call through when the first was turned away a minute ago', () => {
    const rejected: IJournalEntry = {
      id: 'first' as TJournalEntryId,
      at: NOW.subtract({ minutes: 1 }),
      rawNumber: '+31851234567',
      caller: stranger('31851234567'),
      dialerName: null,
      outcome: {
        kind: 'screened',
        verdict: 'awaiting-repeat',
        groupAtCall: 'spam' as TGroupId,
        alsoClaimedBy: [],
      },
    };
    const found = checkNumber(
      query('+31851234567'),
      contextOf(bookOf([SPAM]), { journal: [rejected] })
    );
    expect(verdictOf(found)).toEqual({ group: 'spam', verdict: 'passed-as-repeat' });
  });

  it('knows a number from the address book as the contact', () => {
    const found = checkNumber(
      query('+31 85 999 0000'),
      contextOf(bookOf([SPAM], [numberMask('+319*')]), {
        knownCallers: [contact('Anna', '31859990000')],
      })
    );
    expect(verdictOf(found)).toEqual({ group: MY_CONTACTS_ID, verdict: 'passed' });
  });

  it('checks a hidden number without any digits', () => {
    const found = checkNumber(query('', { hidden: true }), contextOf(bookOf([SPAM])));
    expect(verdictOf(found)).toEqual({ group: 'spam', verdict: 'awaiting-repeat' });
  });

  it('says plainly when what was typed is no number', () => {
    expect(checkNumber(query('call me'), contextOf(bookOf([SPAM])))).toEqual({
      kind: 'no-number',
    });
  });

  it('lets everything through while the filter is paused', () => {
    const found = checkNumber(query('+31851234567'), contextOf(bookOf([SPAM]), { paused: true }));
    expect(verdictOf(found)).toEqual({ group: 'spam', verdict: 'paused' });
  });
});
