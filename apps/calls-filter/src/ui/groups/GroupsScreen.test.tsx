import { fireEvent, screen } from 'expo-router/testing-library';
import { Temporal } from 'temporal-polyfill';

import GroupRoute from '../../app/group/[id]';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import {
  bookOf,
  custom,
  special,
  MY_CONTACTS_ID,
  STRANGERS_ID,
} from '../../contexts/grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK, ALWAYS_PASS, withConditions } from '../../contexts/policy/domain/policy';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';
import { GroupsScreen } from './GroupsScreen';

function GroupsRoute() {
  return <GroupsScreen />;
}

const SPAM = custom('spam', [special('foreign')], { policy: ALWAYS_BLOCK });
const ONLY_ON_HOLIDAYS = custom('holidays', [], {
  policy: {
    ...ALWAYS_BLOCK,
    conditions: {
      schedule: null,
      calendars: [
        {
          source: {
            kind: 'device',
            accountType: 'com.google',
            accountName: 'me@example.com',
            calendarName: 'Holidays',
          },
          mode: 'only-during-events',
          filter: {
            skipDeclined: true,
            includeAllDay: true,
            minutesBefore: 0,
            minutesAfter: 0,
          },
        },
      ],
      places: [],
    },
  },
});

describe('the groups and their rules', () => {
  it('deletes a group with the button a swipe uncovers on its row', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp({ index: GroupsRoute }, { phone });

    await fireEvent.press(await screen.findByTestId('group-delete-spam'));

    expect(screen.queryByTestId('group-spam')).not.toBeOnTheScreen();
    const saved = phone.saved();
    expect(saved === null ? null : findGroup(saved, 'spam' as TGroupId)).toBeNull();
  });

  it('shows what a group that never changes does by its row alone, with no status line', async () => {
    const open = custom('friends', [], { policy: ALWAYS_PASS });
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM, open]) }) });

    expect(await screen.findByTestId('group-spam-action-block')).toBeOnTheScreen();
    expect(screen.getByTestId('group-friends-action-pass')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-spam-status')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('group-friends-status')).not.toBeOnTheScreen();
  });

  it('says until when a group with working hours is in force, the row in the colour of what it does', async () => {
    const work = custom('work', [], {
      policy: withConditions(ALWAYS_PASS, {
        schedule: {
          zone: { kind: 'here' },
          start: Temporal.PlainDate.from('2026-11-02'),
          times: [
            {
              kind: 'range',
              from: Temporal.PlainTime.from('09:00'),
              to: Temporal.PlainTime.from('18:00'),
            },
          ],
          repeat: {
            frequency: 'weekly',
            interval: 1,
            weekdays: [1, 2, 3, 4, 5],
            monthly: null,
            end: { kind: 'never' },
          },
          exceptDates: [],
        },
        calendars: [],
        places: [],
      }),
    });
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([work]) }) });

    expect(await screen.findByTestId('group-work-action-pass')).toBeOnTheScreen();
    expect(screen.getByTestId('group-work-status')).toHaveTextContent(/18:00/);
  });

  it('switches a group off from the button a left swipe uncovers, its dot turned into a ring', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp({ index: GroupsRoute }, { phone });

    expect(await screen.findByTestId('group-dot-spam')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('group-switch-spam'));

    expect(await screen.findByTestId('group-dot-off-spam')).toBeOnTheScreen();
    expect(screen.getByTestId('group-spam-title')).toHaveStyle({ opacity: 0.6 });
    const saved = phone.saved();
    expect(saved === null ? null : findGroup(saved, 'spam' as TGroupId)?.enabled).toBe(false);

    await fireEvent.press(screen.getByTestId('group-switch-spam'));
    expect(await screen.findByTestId('group-dot-spam')).toBeOnTheScreen();
  });

  it('lets the groups the app keeps itself be switched off too', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    expect(await screen.findByTestId(`group-switch-${STRANGERS_ID}`)).toBeOnTheScreen();
  });

  it('uncovers no deletion on a group the app keeps itself', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    expect(await screen.findByTestId(`group-${STRANGERS_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`group-delete-${STRANGERS_ID}`)).not.toBeOnTheScreen();
  });

  it('marks the groups the app keeps itself as pinned, and only them', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    expect(await screen.findByTestId(`group-pinned-${MY_CONTACTS_ID}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`group-pinned-${STRANGERS_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId('group-pinned-spam')).not.toBeOnTheScreen();
  });

  it('marks with a funnel the groups that act only under their conditions, and only them', async () => {
    await renderApp(
      { index: GroupsRoute },
      { phone: fakePhone({ book: bookOf([SPAM, ONLY_ON_HOLIDAYS]) }) }
    );

    expect(await screen.findByTestId('group-conditioned-holidays')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-conditioned-spam')).not.toBeOnTheScreen();
  });

  it('fades the name of a group none of whose conditions holds now, and only that one', async () => {
    await renderApp(
      { index: GroupsRoute },
      { phone: fakePhone({ book: bookOf([SPAM, ONLY_ON_HOLIDAYS]) }) }
    );

    expect(await screen.findByTestId('group-holidays-title')).toHaveStyle({ opacity: 0.6 });
    expect(screen.getByTestId('group-spam-title')).not.toHaveStyle({ opacity: 0.6 });
  });

  it('turns «a repeat call rings» on for the whole filter', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp({ index: GroupsRoute }, { phone });
    await fireEvent.press(await screen.findByTestId('filter-repeat'));
    await fireEvent.press(await screen.findByTestId('repeat-always'));
    expect(screen.queryByTestId('repeat-sheet')).toBeNull();
    expect(phone.preferences().repeatPass).toEqual({ kind: 'always' });
    expect(screen.getByTestId('filter-repeat')).toBeSelected();
  });

  it('shows «a repeat call rings» off as an empty indicator', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    expect(await screen.findByTestId('filter-repeat')).not.toBeSelected();
  });

  it('pauses the whole filter from the button by the title, red while paused, and resumes it from there', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    expect(await screen.findByTestId('pause-open')).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('pause-open'));
    await fireEvent.press(await screen.findByTestId('pause-1h'));

    expect(screen.getByTestId('filter-paused-until')).toBeOnTheScreen();
    expect(screen.getByTestId('pause-resume')).toBeSelected();
    await fireEvent.press(screen.getByTestId('pause-resume'));
    expect(screen.getByTestId('pause-open')).not.toBeSelected();
    expect(screen.queryByTestId('filter-paused-until')).not.toBeOnTheScreen();
  });

  it('offers to pause for 1, 2, 4 or 8 hours, a day, a week, or until tomorrow', async () => {
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([SPAM]) }) });

    await fireEvent.press(await screen.findByTestId('pause-open'));

    const terms = screen
      .getAllByTestId(/^pause-(\d+h|day|week|tomorrow|30m|evening)$/)
      .map(term => term.props.testID as string);
    expect(terms).toEqual([
      'pause-1h',
      'pause-2h',
      'pause-4h',
      'pause-8h',
      'pause-day',
      'pause-week',
      'pause-tomorrow',
    ]);
  });

  it('opens a new group from the plus by the title', async () => {
    const rendered = await renderApp(
      { index: GroupsRoute, 'group/new': () => null },
      { phone: fakePhone({ book: bookOf([SPAM]) }) }
    );

    await fireEvent.press(await screen.findByTestId('group-create'));

    expect(rendered.getPathname()).toBe('/group/new');
  });

  it('shows the status of a group acting only outside holidays, whose action never changes', async () => {
    const holidaysOnly = custom('work', [], {
      policy: {
        ...ALWAYS_PASS,
        conditions: {
          schedule: null,
          calendars: [
            {
              source: {
                kind: 'device',
                accountType: 'com.google',
                accountName: 'me@example.com',
                calendarName: 'Holidays',
              },
              mode: 'except-events',
              filter: {
                skipDeclined: true,
                includeAllDay: true,
                minutesBefore: 0,
                minutesAfter: 0,
              },
            },
          ],
          places: [],
        },
      },
    });
    await renderApp({ index: GroupsRoute }, { phone: fakePhone({ book: bookOf([holidaysOnly]) }) });
    expect(await screen.findByTestId('group-work')).toBeOnTheScreen();
  });

  it('offers to settle a special mask two groups share, and keeps it where the user says', async () => {
    const delivery = custom('delivery', []);
    const phone = fakePhone({ book: bookOf([SPAM, delivery]) });
    await renderApp({ 'group/[id]': GroupRoute }, { phone, initialUrl: '/group/delivery' });
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));
    await fireEvent.press(await screen.findByTestId('special-foreign'));
    await fireEvent.press(await screen.findByTestId('resolve-keep-in-delivery'));

    expect(screen.queryByTestId('pending-conflict')).toBeNull();
    expect(screen.getByTestId('special-foreign')).toHaveProp('accessibilityState', {
      checked: true,
    });
    const saved = phone.saved();
    const spam = saved === null ? null : findGroup(saved, 'spam' as TGroupId);
    expect(spam?.kind === 'custom' ? spam.include : null).toEqual([]);
  });

  it('leaves a special mask in both groups when the user keeps the conflict as it is', async () => {
    const delivery = custom('delivery', []);
    const phone = fakePhone({ book: bookOf([SPAM, delivery]) });
    await renderApp({ 'group/[id]': GroupRoute }, { phone, initialUrl: '/group/delivery' });
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));
    await fireEvent.press(await screen.findByTestId('special-foreign'));
    await fireEvent.press(await screen.findByTestId('pending-keep'));

    expect(screen.queryByTestId('pending-conflict')).toBeNull();
    const saved = phone.saved();
    const both = ['spam', 'delivery'].map(id => {
      const group = saved === null ? null : findGroup(saved, id as TGroupId);
      return group?.kind === 'custom' ? group.include.map(member => member.kind) : null;
    });
    expect(both).toEqual([['special'], ['special']]);
  });
});
