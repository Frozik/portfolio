import { fireEvent, screen, within } from 'expo-router/testing-library';
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

  it('lets calls through once its status, tapped, is switched to let through', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/group/spam' });

    await fireEvent.press(await screen.findByTestId('group-status'));
    await fireEvent.press(within(screen.getByTestId('policy-sheet')).getByTestId('always-pass'));

    expect(spamIn(phone)?.policy.otherwise).toBe('pass');
  });

  it('shows the group without the status sheet on the way back from the schedule it opened', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    await fireEvent.press(await screen.findByTestId('group-status'));
    await fireEvent.press(within(screen.getByTestId('policy-sheet')).getByTestId('add-schedule'));

    await screen.findByTestId('schedule-repeat');
    await fireEvent.press(screen.getByTestId('screen-back'));

    expect(await screen.findByTestId('group-status')).toBeOnTheScreen();
    expect(screen.queryByTestId('policy-sheet')).not.toBeOnTheScreen();
  });

  it('offers a change for a while from its status', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    await fireEvent.press(await screen.findByTestId('group-status'));
    await fireEvent.press(screen.getByTestId('policy-for-a-while'));

    expect(await screen.findByTestId('temporary-sheet')).toBeOnTheScreen();
  });

  it('tells where a stranger’s number is from once the catalogue has loaded', async () => {
    const call: IJournalEntry = {
      id: 'call-ru' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+79630001234',
      caller: stranger('79630001234'),
      dialerName: null,
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

  it('names a stranger as the phone’s dialer found it', async () => {
    const call: IJournalEntry = {
      id: 'call-bakery' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+31201234567',
      caller: stranger('31201234567'),
      dialerName: 'Bakkerij de Graaf',
      outcome: { kind: 'history', type: 'missed' },
    };
    const phone = fakePhone({ book: bookOf([SPAM]), journal: [call] });
    await renderApp(ROUTES, { phone, initialUrl: `/group/${STRANGERS_ID}` });

    expect(await screen.findByTestId('call-dialer-name-call-bakery')).toHaveTextContent(
      'Bakkerij de Graaf',
      { exact: false }
    );
  });

  it('moves a stranger’s call to another group with the button on its row', async () => {
    const call: IJournalEntry = {
      id: 'call-1' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+31851234567',
      caller: stranger('31851234567'),
      dialerName: null,
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

describe('the SMS reply among a group’s further settings', () => {
  async function openFurtherSettings(smsReply: boolean) {
    const phone = fakePhone({ book: bookOf([SPAM]), smsReply });
    await renderApp(ROUTES, { phone, initialUrl: '/group/spam' });
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));
    await fireEvent.press(screen.getByTestId('group-advanced'));
  }

  it('is offered where the app can send an SMS', async () => {
    await openFurtherSettings(true);

    expect(screen.getByTestId('auto-reply')).toBeOnTheScreen();
  });

  it('is not offered in the edition built without SMS', async () => {
    await openFurtherSettings(false);

    expect(screen.getByTestId('repeat-window-5')).toBeOnTheScreen();
    expect(screen.queryByTestId('auto-reply')).not.toBeOnTheScreen();
  });
});
