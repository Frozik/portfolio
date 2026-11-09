import type { GroupBook } from '../contexts/grouping/domain/group-book';
import type { TRepeatPass } from '../contexts/policy/domain/repeat-pass';
import { REPEAT_OFF } from '../contexts/policy/domain/repeat-pass';
import {
  EMPTY_BOOK,
  HELSINKI_OFFICE_BOOK,
  OFFICE_ONLY_BOOK,
  SCENARIO_BOOK,
  TEMPORARY_BOOK,
  WEEKEND_BOOK,
} from './scenario-world';

interface IScenarioCaller {
  readonly number: string | null;
  readonly country: string | null;
  readonly type:
    | 'mobile'
    | 'fixed-line'
    | 'premium-rate'
    | 'shared-cost'
    | 'voip'
    | 'toll-free'
    | 'other';
  readonly networkName: string | null;
  readonly contactName: string | null;
  readonly contactLookupKey: string | null;
}

export interface IScenario {
  readonly name: string;
  readonly book: GroupBook;
  readonly caller: IScenarioCaller;
  /** Wall-clock time where the phone is. */
  readonly local: string;
  readonly networkCountry: string | null;
  readonly paused: boolean;
  /** The filter-wide «a repeat rings». */
  readonly repeatPass: TRepeatPass;
  /** What the geofences say for each place; a place left out is unknown. */
  readonly places: Readonly<Record<string, boolean>>;
  /** Minutes before the call this number was last turned away, if it was. */
  readonly rejectedMinutesAgo: number | null;
}

function caller(partial: Partial<IScenarioCaller>): IScenarioCaller {
  return {
    number: '31201234567',
    country: 'NL',
    type: 'fixed-line',
    networkName: null,
    contactName: null,
    contactLookupKey: null,
    ...partial,
  };
}

function scenario(name: string, partial: Partial<Omit<IScenario, 'name'>>): IScenario {
  return {
    name,
    book: SCENARIO_BOOK,
    caller: caller({}),
    local: '2026-11-03T10:30',
    networkCountry: 'NL',
    paused: false,
    repeatPass: REPEAT_OFF,
    places: {},
    rejectedMinutesAgo: null,
    ...partial,
  };
}

const contactCaller = (name: string, number: string) =>
  caller({ number, type: 'mobile', contactName: name, contactLookupKey: `lookup-${name}` });

export const SCENARIOS: readonly IScenario[] = [
  scenario('a number no group takes passes as a stranger', {}),
  scenario('a spam mask rejects', { caller: caller({ number: '74951112233', country: 'RU' }) }),
  scenario('an exclusion takes a number out of spam, to the next group that has it', {
    caller: caller({ number: '74951234567', country: 'RU' }),
  }),
  scenario('a premium-rate number is spam', {
    caller: caller({ number: '319001234567', type: 'premium-rate' }),
  }),
  scenario('an operator name puts a caller in spam', {
    caller: caller({ number: '31301234567', networkName: 'KPN Klantenservice' }),
  }),
  scenario('a contact passes in my contacts', {
    caller: contactCaller('Neighbour', '31611111111'),
  }),
  scenario('mum is in family, not in my contacts', { caller: contactCaller('Mum', '31612345678') }),
  scenario('work passes in working hours', { caller: caller({ number: '31205551234' }) }),
  scenario('work blocks during a meeting', {
    caller: caller({ number: '31205551234' }),
    local: '2026-11-03T14:30',
  }),
  scenario('work blocks on a holiday', {
    caller: caller({ number: '31205551234' }),
    local: '2026-11-04T11:00',
  }),
  scenario('work blocks on a skipped date', {
    caller: caller({ number: '31205551234' }),
    local: '2026-11-13T11:00',
  }),
  scenario('work blocks at the weekend', {
    caller: caller({ number: '31205551234' }),
    local: '2026-11-07T11:00',
  }),
  scenario('work blocks at six sharp', {
    caller: caller({ number: '31205551234' }),
    local: '2026-11-03T18:00',
  }),
  scenario('a work colleague in the address book is still work', {
    caller: { ...contactCaller('Colleague', '31205551234') },
  }),
  scenario('delivery waits for a repeat while its repeat switch is on', {
    caller: caller({ number: '31851234567' }),
    local: '2026-11-06T12:00',
  }),
  scenario('delivery passes the second call within the window', {
    caller: caller({ number: '31851234567' }),
    local: '2026-11-06T12:00',
    rejectedMinutesAgo: 3,
  }),
  scenario('delivery waits again once the window is over', {
    caller: caller({ number: '31851234567' }),
    local: '2026-11-06T12:00',
    rejectedMinutesAgo: 9,
  }),
  scenario('delivery blocks once its repeat switch ran out', {
    caller: caller({ number: '31851234567' }),
    local: '2026-11-09T12:00',
  }),
  scenario('the filter-wide repeat switch lets blocked spam ring the second time', {
    caller: caller({ number: '74951112233', country: 'RU' }),
    repeatPass: { kind: 'always' },
    rejectedMinutesAgo: 2,
  }),
  scenario('the filter-wide repeat switch still turns the first call away', {
    caller: caller({ number: '74951112233', country: 'RU' }),
    repeatPass: { kind: 'always' },
  }),
  scenario('a temporary «let through» opens a blocking group for a while', {
    book: TEMPORARY_BOOK,
    caller: caller({ number: '31851234567' }),
    local: '2026-11-06T12:00',
  }),
  scenario('the group blocks again once the temporary policy ended', {
    book: TEMPORARY_BOOK,
    caller: caller({ number: '31851234567' }),
    local: '2026-11-09T12:00',
  }),
  scenario("a schedule on Helsinki's clock already passes at 8:30 in Amsterdam", {
    book: HELSINKI_OFFICE_BOOK,
    caller: caller({ number: '35891234567', country: 'FI' }),
    local: '2026-11-03T08:30',
  }),
  scenario("a schedule on Helsinki's clock already blocks at 17:30 in Amsterdam", {
    book: HELSINKI_OFFICE_BOOK,
    caller: caller({ number: '35891234567', country: 'FI' }),
    local: '2026-11-03T17:30',
  }),
  scenario('a group that acts only at the office does at the office', {
    book: OFFICE_ONLY_BOOK,
    caller: caller({ number: '31201234567' }),
    places: { office: true },
  }),
  scenario('a group that acts only at the office does not elsewhere', {
    book: OFFICE_ONLY_BOOK,
    caller: caller({ number: '31201234567' }),
    places: { office: false },
  }),
  scenario('a place nobody knows the state of leaves the decision to the rest', {
    book: OFFICE_ONLY_BOOK,
    caller: caller({ number: '31201234567' }),
  }),
  scenario('an operator name puts any number in delivery', {
    caller: caller({ number: '31107654321', networkName: 'PostNL Bezorging' }),
  }),
  scenario('a hidden number passes by day', {
    caller: caller({ number: null, country: null }),
    local: '2026-11-03T12:00',
  }),
  scenario('a hidden number is rejected at night across midnight', {
    caller: caller({ number: null, country: null }),
    local: '2026-11-04T06:30',
  }),
  scenario('a foreign number is blocked', {
    caller: caller({ number: '442079460000', country: 'GB' }),
  }),
  scenario('a foreign number passes on a holiday where the phone is', {
    caller: caller({ number: '442079460000', country: 'GB' }),
    local: '2026-11-04T12:00',
  }),
  scenario('a Finnish number is not foreign in Finland, and the holidays are Finnish', {
    caller: caller({ number: '358401234567', country: 'FI' }),
    networkCountry: 'FI',
    local: '2026-11-04T12:00',
  }),
  scenario('a Dutch number abroad is foreign there', {
    caller: caller({ number: '31201234567', country: 'NL' }),
    networkCountry: 'FI',
  }),
  scenario('a courier contact is rejected only during a work event', {
    caller: contactCaller('Courier Ozon', '31687654321'),
    local: '2026-11-05T10:30',
  }),
  scenario('a courier contact passes outside work events', {
    caller: contactCaller('Courier Ozon', '31687654321'),
    local: '2026-11-05T12:00',
  }),
  scenario('an open conflict settles on the most lenient group', {
    caller: caller({ number: '74991234567', country: 'RU' }),
  }),
  scenario('a pause lets spam through', {
    caller: caller({ number: '74951112233', country: 'RU' }),
    paused: true,
  }),
  scenario('accents and case never decide a name', {
    caller: caller({ number: '31301234567', networkName: 'KPN KLANTENSERVİCE' }),
  }),
  scenario('an empty book takes everyone as a stranger', {
    book: EMPTY_BOOK,
    caller: caller({ number: '74951112233', country: 'RU' }),
  }),
  scenario('the weekend schedule includes holidays', {
    book: WEEKEND_BOOK,
    local: '2026-11-04T09:00',
  }),
  scenario('the weekend schedule passes a weekday', {
    book: WEEKEND_BOOK,
    local: '2026-11-05T09:00',
  }),
];
