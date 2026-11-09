import { fireEvent, screen } from 'expo-router/testing-library';

import CallsRoute from '../../app/(tabs)/calls';
import CheckRoute from '../../app/check';
import {
  bookOf,
  contact,
  custom,
  numberMask,
  special,
} from '../../contexts/grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK } from '../../contexts/policy/domain/policy';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const ROUTES = { calls: CallsRoute, check: CheckRoute };

const SPAM = custom('spam', [numberMask('+3185*'), special('hidden')], { policy: ALWAYS_BLOCK });

function openCheck(phone = fakePhone({ book: bookOf([SPAM]) })) {
  return renderApp(ROUTES, { phone, initialUrl: '/check' });
}

describe('checking a number: what the filter would do if it called now', () => {
  it('opens from the Calls tab', async () => {
    const { getPathname } = await renderApp(ROUTES, {
      phone: fakePhone({ book: bookOf([SPAM]) }),
      initialUrl: '/calls',
    });
    await fireEvent.press(await screen.findByTestId('open-check'));
    expect(await screen.findByTestId('check-screen')).toBeOnTheScreen();
    expect(getPathname()).toBe('/check');
  });

  it('turns away a number a group blocks', async () => {
    await openCheck();
    await fireEvent.changeText(await screen.findByTestId('check-number'), '+31 85 123 4567');
    expect(await screen.findByTestId('check-verdict-rejected')).toBeOnTheScreen();
  });

  it('lets a contact through, saying who they are', async () => {
    await openCheck(
      fakePhone({ book: bookOf([SPAM]), contacts: [contact('Anna', '31859990000')] })
    );
    await fireEvent.changeText(await screen.findByTestId('check-number'), '+31 85 999 0000');
    expect(await screen.findByTestId('check-verdict-passed')).toBeOnTheScreen();
    expect(screen.getByTestId('check-contact')).toBeOnTheScreen();
  });

  it('checks a hidden number without digits', async () => {
    await openCheck();
    await fireEvent.press(await screen.findByTestId('check-hidden'));
    expect(screen.queryByTestId('check-number')).toBeNull();
    expect(await screen.findByTestId('check-verdict-rejected')).toBeOnTheScreen();
  });

  it('says when what was typed is no number', async () => {
    await openCheck();
    await fireEvent.changeText(await screen.findByTestId('check-number'), 'pizza');
    expect(await screen.findByTestId('check-no-number')).toBeOnTheScreen();
  });
});
