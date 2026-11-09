import { fireEvent, screen } from 'expo-router/testing-library';

import GroupRoute from '../../app/group/[id]';
import type { ICustomGroup } from '../../contexts/grouping/domain/group';
import { bookOf, custom, special } from '../../contexts/grouping/testing/group-book-fixtures';
import type { IPlaceRule, TPlaceId } from '../../contexts/policy/domain/place-rule';
import { ALWAYS_BLOCK } from '../../contexts/policy/domain/policy';
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

  it('marks a place whose state the phone does not know yet', async () => {
    await openRules(
      custom('work', [], {
        policy: {
          ...ALWAYS_BLOCK,
          scheduled: { action: 'pass', schedule: null, calendars: [], places: [OFFICE] },
        },
      })
    );
    expect(await screen.findByTestId('place-state-unknown')).toBeOnTheScreen();
  });
});
