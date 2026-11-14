import { router } from 'expo-router';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import GroupsTabs from '../app/(tabs)/_layout';
import GroupRoute from '../app/group/[id]';
import MaskRoute from '../app/mask';
import PlaceRoute from '../app/place';
import ScheduleRoute from '../app/schedule';
import { bookOf, custom } from '../contexts/grouping/testing/group-book-fixtures';
import { fakePhone } from '../testing/fake-ports';
import { pressBack } from '../testing/press-back';
import { renderApp } from '../testing/render-app';

const ROUTES = {
  '(tabs)/_layout': GroupsTabs,
  '(tabs)/index': () => null,
  'group/[id]': GroupRoute,
  schedule: ScheduleRoute,
  place: PlaceRoute,
  mask: MaskRoute,
};
const SPAM = custom('spam', []);
const WORK = custom('work', []);

describe('the phone’s back', () => {
  it('takes a group a link opened, with nothing behind it, back to the groups', async () => {
    const rendered = await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/group/spam',
    });

    await pressBack();

    expect(rendered.getPathname()).toBe('/');
  });
});

describe('a screen of a group that is gone', () => {
  it.each(['/group/gone', '/schedule?group=gone', '/place?group=gone', '/mask?group=gone'])(
    'leaves %s for the groups instead of standing empty',
    async initialUrl => {
      const rendered = await renderApp(ROUTES, {
        phone: fakePhone({ book: bookOf([SPAM]) }),
        initialUrl,
      });

      expect(rendered.getPathname()).toBe('/');
    }
  );
});

describe('a group deleted on its own screen', () => {
  it('goes back one screen, to the one it was opened from', async () => {
    const rendered = await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM, WORK]) }),
      initialUrl: '/group/work',
    });
    await screen.findByTestId('group-screen-work');
    await act(async () => {
      router.push('/group/spam');
      await Promise.resolve();
    });
    const spam = within(await screen.findByTestId('group-screen-spam'));
    await fireEvent.press(spam.getByTestId('group-tab-rules'));

    await fireEvent.press(spam.getByTestId('group-delete'));

    expect(rendered.getPathname()).toBe('/group/work');
  });
});
