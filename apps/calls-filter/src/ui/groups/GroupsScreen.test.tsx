import { fireEvent, screen } from 'expo-router/testing-library';

import GroupRoute from '../../app/group/[id]';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { bookOf, custom, special } from '../../contexts/grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK, ALWAYS_PASS } from '../../contexts/policy/domain/policy';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';
import { GroupsScreen } from './GroupsScreen';

function GroupsRoute() {
  return <GroupsScreen />;
}

const SPAM = custom('spam', [special('foreign')], { policy: ALWAYS_BLOCK });

describe('the groups and their rules', () => {
  it('turns «a repeat call rings» on for the whole filter', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp({ index: GroupsRoute }, { phone });
    await fireEvent.press(await screen.findByTestId('filter-repeat'));
    await fireEvent.press(await screen.findByTestId('repeat-always'));
    expect(screen.queryByTestId('repeat-sheet')).toBeNull();
    expect(phone.preferences().repeatPass).toEqual({ kind: 'always' });
  });

  it('shows the status of a group acting only outside holidays, whose action never changes', async () => {
    const holidaysOnly = custom('work', [], {
      policy: {
        ...ALWAYS_PASS,
        otherwise: 'block',
        scheduled: {
          action: 'pass',
          schedule: null,
          calendars: [
            {
              source: { kind: 'holidays-here' },
              mode: 'except-events',
              filter: {
                busyOnly: false,
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
});
