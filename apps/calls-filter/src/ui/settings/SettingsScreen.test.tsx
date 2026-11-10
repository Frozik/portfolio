import { fireEvent, screen } from 'expo-router/testing-library';

import SettingsRoute from '../../app/(tabs)/settings';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const ROUTES = { settings: SettingsRoute };

describe('the settings', () => {
  it('list the SMS permission where the app can reply by SMS', async () => {
    await renderApp(ROUTES, { initialUrl: '/settings' });

    expect(await screen.findByTestId('settings-permission-sms')).toBeOnTheScreen();
  });

  it('list no SMS permission in the edition built without SMS', async () => {
    await renderApp(ROUTES, { phone: fakePhone({ smsReply: false }), initialUrl: '/settings' });

    expect(await screen.findByTestId('settings-permission-contacts')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-permission-sms')).not.toBeOnTheScreen();
  });

  it('choose the language from a list, the chosen one marked', async () => {
    await renderApp(ROUTES, { initialUrl: '/settings' });

    await fireEvent.press(await screen.findByTestId('settings-language'));
    await fireEvent.press(await screen.findByTestId('language-ru'));
    await fireEvent.press(screen.getByTestId('settings-language'));

    expect(await screen.findByTestId('language-ru')).toBeSelected();
    expect(screen.getByTestId('language-system')).not.toBeSelected();
  });

  it('switch the theme by a sliding switch', async () => {
    const phone = fakePhone();
    await renderApp(ROUTES, { phone, initialUrl: '/settings' });

    await fireEvent.press(await screen.findByTestId('theme-dark'));

    expect(screen.getByTestId('theme-dark')).toBeSelected();
    expect(phone.preferences().theme).toBe('dark');
  });

  it('mark each permission the phone has not given, and only those', async () => {
    const phone = fakePhone();
    await renderApp(ROUTES, {
      phone: {
        ...phone,
        ports: {
          ...phone.ports,
          permissions: {
            state: async permission => (permission === 'call-log' ? 'denied' : 'granted'),
            request: async permission => (permission === 'call-log' ? 'denied' : 'granted'),
          },
        },
      },
      initialUrl: '/settings',
    });

    expect(await screen.findByTestId('settings-permission-call-log-attention')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-permission-contacts-attention')).not.toBeOnTheScreen();
  });
});
