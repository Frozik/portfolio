import { fireEvent, screen } from 'expo-router/testing-library';
import { Temporal } from 'temporal-polyfill';

import GroupRoute from '../../app/group/[id]';
import ScheduleRoute from '../../app/schedule';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import {
  bookOf,
  custom,
  STRANGERS_ID,
  stranger,
} from '../../contexts/grouping/testing/group-book-fixtures';
import type { IJournalEntry, TJournalEntryId } from '../../contexts/journal/domain/journal-entry';
import { ALWAYS_BLOCK } from '../../contexts/policy/domain/policy';
import type { IFakePhone } from '../../testing/fake-ports';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const ROUTES = { 'group/[id]': GroupRoute, schedule: ScheduleRoute };
const SPAM = custom('spam', [], { policy: ALWAYS_BLOCK });
const SPAM_ID = 'spam' as TGroupId;

function spamIn(phone: IFakePhone) {
  const saved = phone.saved();
  const group = saved === null ? null : findGroup(saved, SPAM_ID);
  return group?.kind === 'custom' ? group : null;
}

const KIROV_BEELINE = {
  mask: '+7*',
  countryCode: 'RU',
  children: [
    {
      mask: '+7963000*',
      countryCode: 'RU',
      networkOperatorCode: 'beeline',
      stateCodes: ['kirov-oblast'],
    },
  ],
} as const;

describe('a group, edited on its own screen', () => {
  it('is renamed with the pencil and coloured by hex', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/group/spam' });
    await fireEvent.press(await screen.findByTestId('group-rename'));
    await fireEvent.changeText(screen.getByTestId('group-name'), 'Spam calls');
    await fireEvent.press(screen.getByTestId('group-name-save'));
    await fireEvent.press(screen.getByTestId('group-color'));
    await fireEvent.changeText(screen.getByTestId('color-hex'), 'FF8800');
    await fireEvent.press(screen.getByTestId('color-hex-apply'));

    expect([spamIn(phone)?.name, spamIn(phone)?.color]).toEqual(['Spam calls', '#ff8800']);
  });

  it('gets a schedule: weekdays on Helsinki’s clock, except holidays', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/schedule?group=spam' });
    await fireEvent.press(await screen.findByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('repeat-weekdays'));
    await fireEvent.press(screen.getByTestId('schedule-holidays'));
    await fireEvent.press(await screen.findByTestId('holidays-not-on-holidays'));
    await fireEvent.press(screen.getByTestId('schedule-zone'));
    await fireEvent.changeText(await screen.findByTestId('zone-search'), 'Helsinki');
    await fireEvent.press(await screen.findByTestId('zone-Europe/Helsinki'));
    await fireEvent.press(screen.getByTestId('schedule-save'));

    expect(spamIn(phone)?.policy.scheduled?.schedule).toMatchObject({
      repeat: { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] },
      zone: { kind: 'fixed', zone: 'Europe/Helsinki' },
      holidays: 'not-on-holidays',
    });
  });

  it('tells where a stranger’s number is from once the catalogue has loaded', async () => {
    const call: IJournalEntry = {
      id: 'call-ru' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+79630001234',
      caller: stranger('79630001234'),
      outcome: {
        kind: 'screened',
        verdict: 'passed',
        groupAtCall: STRANGERS_ID,
        alsoClaimedBy: [],
      },
    };
    const phone = fakePhone({
      book: bookOf([SPAM]),
      journal: [call],
      numberingCatalogue: [KIROV_BEELINE],
    });
    await renderApp(ROUTES, { phone, initialUrl: `/group/${STRANGERS_ID}` });
    expect(await screen.findByTestId('call-origin-call-ru')).toBeOnTheScreen();
  });

  it('moves a stranger’s call to another group with the button on its row', async () => {
    const call: IJournalEntry = {
      id: 'call-1' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+31851234567',
      caller: stranger('31851234567'),
      outcome: {
        kind: 'screened',
        verdict: 'passed',
        groupAtCall: STRANGERS_ID,
        alsoClaimedBy: [],
      },
    };
    const phone = fakePhone({ book: bookOf([SPAM]), journal: [call] });
    await renderApp(ROUTES, { phone, initialUrl: `/group/${STRANGERS_ID}` });
    await fireEvent.press(await screen.findByTestId('call-move-call-1'));
    await fireEvent.press(await screen.findByTestId('move-to-spam'));

    expect(
      spamIn(phone)?.include.map(member =>
        member.kind === 'number-mask' ? member.mask.source : member.kind
      )
    ).toEqual(['+31851234567']);
  });
});
