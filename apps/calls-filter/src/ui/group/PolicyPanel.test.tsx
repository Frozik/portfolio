import { fireEvent, screen } from 'expo-router/testing-library';

import GroupRoute from '../../app/group/[id]';
import type { ICustomGroup } from '../../contexts/grouping/domain/group';
import { bookOf, custom, special } from '../../contexts/grouping/testing/group-book-fixtures';
import type { IPlaceRule, TPlaceId } from '../../contexts/policy/domain/place-rule';
import { ALWAYS_BLOCK, ALWAYS_PASS } from '../../contexts/policy/domain/policy';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const OFFICE: IPlaceRule = {
  id: 'office' as TPlaceId,
  name: 'Office',
  latitude: 52.3676,
  longitude: 4.9041,
  radius: 500,
  mode: 'only-at',
};

async function openRules(group: ICustomGroup) {
  await renderApp(
    { 'group/[id]': GroupRoute },
    { phone: fakePhone({ book: bookOf([group]) }), initialUrl: `/group/${group.id}` }
  );
  await fireEvent.press(await screen.findByTestId('group-tab-rules'));
}

describe('the rules of a group', () => {
  it('warns that a hidden number cannot ring as a repeat', async () => {
    await openRules(
      custom('spam', [special('hidden')], {
        policy: { ...ALWAYS_BLOCK, repeatPass: { kind: 'always' } },
      })
    );
    expect(await screen.findByTestId('repeat-hidden-miss')).toBeOnTheScreen();
  });

  it('says nothing of hidden numbers while a repeat does not ring', async () => {
    await openRules(custom('spam', [special('hidden')]));
    expect(await screen.findByTestId('group-repeat')).toBeOnTheScreen();
    expect(screen.queryByTestId('repeat-hidden-miss')).toBeNull();
  });

  it('offers no repeat call to a group that lets calls through: there is nothing to ring past', async () => {
    await openRules(custom('friends', [], { policy: ALWAYS_PASS }));
    expect(await screen.findByTestId('add-schedule')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-repeat')).not.toBeOnTheScreen();
  });

  it('offers no repeat call to a group letting calls through only at a place either', async () => {
    await openRules(
      custom('friends', [], {
        policy: { ...ALWAYS_PASS, conditions: { schedule: null, calendars: [], places: [OFFICE] } },
      })
    );
    expect(await screen.findByTestId('add-schedule')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-repeat')).not.toBeOnTheScreen();
  });

  it('marks a place whose state the phone does not know yet', async () => {
    await openRules(
      custom('work', [], {
        policy: {
          ...ALWAYS_BLOCK,
          conditions: { schedule: null, calendars: [], places: [OFFICE] },
        },
      })
    );
    expect(await screen.findByTestId('place-state-unknown')).toBeOnTheScreen();
  });

  it('fills the place icon of a group that has a place, and leaves it empty for one that has none', async () => {
    await openRules(
      custom('work', [], {
        policy: {
          ...ALWAYS_BLOCK,
          conditions: { schedule: null, calendars: [], places: [OFFICE] },
        },
      })
    );
    expect(await screen.findByTestId('add-place')).toBeSelected();
  });

  it('adds a place to the group from the place icon', async () => {
    const rendered = await renderApp(
      { 'group/[id]': GroupRoute, place: () => null },
      { phone: fakePhone({ book: bookOf([custom('spam', [])]) }), initialUrl: '/group/spam' }
    );
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));

    expect(screen.getByTestId('add-place')).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('add-place'));

    expect(rendered.getPathname()).toBe('/place');
  });
});
