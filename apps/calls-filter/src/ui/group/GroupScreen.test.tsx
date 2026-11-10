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

  it('asks nothing on its schedule of what the group does: that stays its own action', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/schedule?group=spam',
    });

    expect(await screen.findByTestId('schedule-save')).toBeOnTheScreen();
    expect(screen.queryByTestId('window-action-block')).not.toBeOnTheScreen();
  });

  it('shows on its rules what the group does while its conditions hold', async () => {
    const conditions = custom('spam', [], {
      policy: {
        ...ALWAYS_BLOCK,
        conditions: { schedule: null, calendars: [], places: [] },
      },
    });
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([conditions]) }),
      initialUrl: '/group/spam',
    });

    await fireEvent.press(await screen.findByTestId('group-tab-rules'));

    expect(screen.getByTestId('while-block')).toBeSelected();
    expect(screen.queryByTestId('always-block')).not.toBeOnTheScreen();
  });

  it('keeps blocking once given a schedule, now only while the schedule holds', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/schedule?group=spam' });

    await fireEvent.press(await screen.findByTestId('schedule-save'));

    expect(spamIn(phone)?.policy.conditions).not.toBeNull();
    expect(spamIn(phone)?.policy.action).toBe('block');
  });

  it('gets a schedule: weekdays on Helsinki’s clock', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/schedule?group=spam' });
    await fireEvent.press(await screen.findByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('repeat-weekdays'));
    await fireEvent.press(screen.getByTestId('schedule-zone'));
    await fireEvent.changeText(await screen.findByTestId('zone-search'), 'Helsinki');
    await fireEvent.press(await screen.findByTestId('zone-Europe/Helsinki'));
    await fireEvent.press(screen.getByTestId('schedule-save'));

    expect(spamIn(phone)?.policy.conditions?.schedule).toMatchObject({
      repeat: { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] },
      zone: { kind: 'fixed', zone: 'Europe/Helsinki' },
    });
  });

  it('lets calls through once its status, tapped, is switched to let through', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(ROUTES, { phone, initialUrl: '/group/spam' });

    await fireEvent.press(await screen.findByTestId('group-status'));
    await fireEvent.press(within(screen.getByTestId('policy-sheet')).getByTestId('always-pass'));

    expect(spamIn(phone)?.policy.action).toBe('pass');
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

  it('opens renaming on holding its name, and colouring on holding its dot', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    await fireEvent(await screen.findByTestId('group-rename'), 'longPress');
    expect(await screen.findByTestId('rename-sheet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('group-name-save'));

    await fireEvent(screen.getByTestId('group-color'), 'longPress');
    expect(await screen.findByTestId('color-sheet')).toBeOnTheScreen();
  });

  it('offers no renaming on the name of a group the app keeps itself', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: `/group/${STRANGERS_ID}`,
    });

    expect(await screen.findByTestId('group-color')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-rename')).not.toBeOnTheScreen();
  });

  it('switches between its calls and its rules, the chosen half marked', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    expect(await screen.findByTestId('group-tab-calls')).toBeSelected();
    await fireEvent.press(screen.getByTestId('group-tab-rules'));

    expect(screen.getByTestId('group-tab-rules')).toBeSelected();
    expect(screen.getByTestId('group-tab-calls')).not.toBeSelected();
    expect(screen.getByTestId('group-repeat')).toBeOnTheScreen();
  });

  it('goes back to the groups by the arrow on the line of its name', async () => {
    const rendered = await renderApp(
      { ...ROUTES, index: () => null },
      { phone: fakePhone({ book: bookOf([SPAM]) }), initialUrl: '/group/spam' }
    );

    await fireEvent.press(await screen.findByTestId('group-back'));

    expect(rendered.getPathname()).toBe('/');
  });

  it('shows in the sheet its icon opens what the group does, as the chosen half of a switch', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    await fireEvent.press(await screen.findByTestId('group-status'));

    const sheet = within(screen.getByTestId('policy-sheet'));
    expect(sheet.getByTestId('always-block')).toBeSelected();
    expect(sheet.getByTestId('always-pass')).not.toBeSelected();
    expect(sheet.getByTestId('always-block')).toHaveProp('accessibilityRole', 'tab');
  });

  it('draws the dot of a switched-off group as a ring', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({
        book: bookOf([custom('spam', [], { policy: ALWAYS_BLOCK, enabled: false })]),
      }),
      initialUrl: '/group/spam',
    });

    expect(await screen.findByTestId('group-dot-off')).toBeOnTheScreen();
    expect(screen.getByTestId('group-rename')).toHaveStyle({ opacity: 0.6 });
  });

  it('keeps the name of a group without conditions bright', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([custom('spam', [], { policy: ALWAYS_BLOCK })]) }),
      initialUrl: '/group/spam',
    });

    expect(await screen.findByTestId('group-rename')).not.toHaveStyle({ opacity: 0.6 });
  });

  it('shows a group the app keeps itself as pinned, with nothing to rename it by', async () => {
    await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: `/group/${STRANGERS_ID}`,
    });

    expect(await screen.findByTestId('group-pinned')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-rename')).not.toBeOnTheScreen();
  });

  it('tells where a stranger’s number is from once the catalogue has loaded', async () => {
    const call: IJournalEntry = {
      id: 'call-ru' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+79630001234',
      caller: stranger('79630001234'),
      dialerName: null,
      answered: null,
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
      answered: false,
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
      answered: null,
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

  it('moves a caller with the operator’s name by that name when the name under the group is tapped', async () => {
    const call: IJournalEntry = {
      id: 'call-2' as TJournalEntryId,
      at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
      rawNumber: '+79864563560',
      caller: stranger('79864563560', 'IP Isanshin'),
      dialerName: null,
      answered: null,
      outcome: { kind: 'history', type: 'rejected' },
    };
    const phone = fakePhone({ book: bookOf([SPAM]), journal: [call] });
    await renderApp(ROUTES, { phone, initialUrl: `/group/${STRANGERS_ID}` });
    await fireEvent.press(await screen.findByTestId('call-move-call-2'));
    await fireEvent.press(await screen.findByTestId('move-to-spam-name'));

    expect(spamIn(phone)?.include.map(member => member.kind)).toEqual(['name-mask']);
  });
});

describe('the settings of a group as icons on its rules', () => {
  async function openRules(group: ReturnType<typeof custom>, smsReply = true) {
    const phone = fakePhone({ book: bookOf([group]), smsReply });
    await renderApp(ROUTES, { phone, initialUrl: `/group/${group.id}` });
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));
    return phone;
  }

  it('sets the SMS reply from its icon, which fills once the group has one', async () => {
    const phone = await openRules(SPAM);
    expect(screen.getByTestId('group-sms')).not.toBeSelected();

    await fireEvent.press(screen.getByTestId('group-sms'));
    await fireEvent.changeText(await screen.findByTestId('auto-reply'), 'In a meeting');
    await fireEvent.press(screen.getByTestId('auto-reply-save'));

    expect(spamIn(phone)?.autoReply).toEqual({ text: 'In a meeting' });
    expect(screen.getByTestId('group-sms')).toBeSelected();
  });

  it('offers no SMS icon in the edition built without SMS', async () => {
    await openRules(SPAM, false);

    expect(screen.getByTestId('group-repeat')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-sms')).not.toBeOnTheScreen();
  });

  it('sets how long a second call counts as a repeat in the repeat sheet, which stays open', async () => {
    const phone = await openRules(SPAM);

    await fireEvent.press(screen.getByTestId('group-repeat'));
    await fireEvent.press(await screen.findByTestId('repeat-window-10'));

    expect(spamIn(phone)?.policy.repeatWindowMinutes).toBe(10);
    expect(screen.getByTestId('repeat-window-10')).toBeSelected();
  });

  it('deletes the group from the button at the end of its rules', async () => {
    const phone = await openRules(SPAM);

    await fireEvent.press(screen.getByTestId('group-delete'));

    expect(spamIn(phone)).toBeNull();
  });

  it('fills the repeat icon while a repeat rings for the group, and opens the repeat from it', async () => {
    await openRules(
      custom('spam', [], { policy: { ...ALWAYS_BLOCK, repeatPass: { kind: 'always' } } })
    );
    expect(screen.getByTestId('group-repeat')).toBeSelected();

    await fireEvent.press(screen.getByTestId('group-repeat'));

    expect(await screen.findByTestId('repeat-sheet')).toBeOnTheScreen();
  });
});
