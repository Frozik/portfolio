import { fireEvent, screen } from 'expo-router/testing-library';

import SettingsRoute from '../../app/(tabs)/settings';
import ConflictsRoute from '../../app/conflicts';
import { bookOf, custom, special } from '../../contexts/grouping/testing/group-book-fixtures';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const ROUTES = { settings: SettingsRoute };

describe('the settings', () => {
  it('list the conflicts with a mark while there are some, and open them', async () => {
    const book = bookOf([
      custom('spam', [special('foreign')]),
      custom('delivery', [special('foreign')]),
    ]);
    await renderApp(
      { ...ROUTES, conflicts: ConflictsRoute },
      { phone: fakePhone({ book }), initialUrl: '/settings' }
    );

    expect(await screen.findByTestId('settings-conflicts-attention')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('settings-conflicts'));

    expect(await screen.findByTestId('conflicts-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('resolve-keep-in-spam')).toBeOnTheScreen();
  });

  it('list the conflicts without a mark while there are none', async () => {
    await renderApp(ROUTES, { initialUrl: '/settings' });

    expect(await screen.findByTestId('settings-conflicts')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-conflicts-attention')).not.toBeOnTheScreen();
  });

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

  it('list the location and the location all the time, which a group with a place needs', async () => {
    await renderApp(ROUTES, { phone: fakePhone(), initialUrl: '/settings' });

    expect(await screen.findByTestId('settings-permission-location')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-permission-background-location')).toBeOnTheScreen();
  });

  it('hold back the location all the time until the location itself is given, as Android asks in that order', async () => {
    const phone = fakePhone();
    await renderApp(ROUTES, {
      phone: {
        ...phone,
        ports: {
          ...phone.ports,
          permissions: { state: async () => 'ask', request: async () => 'denied' },
        },
      },
      initialUrl: '/settings',
    });

    expect(await screen.findByTestId('settings-permission-location')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-permission-background-location')).not.toBeOnTheScreen();
  });

  it('ask Android again for a permission refused once, while Android still shows its dialog', async () => {
    const phone = fakePhone();
    const opened: string[] = [];
    const asked: string[] = [];
    await renderApp(ROUTES, {
      phone: {
        ...phone,
        ports: {
          ...phone.ports,
          permissions: {
            state: async permission => (permission === 'contacts' ? 'ask' : 'granted'),
            request: async permission => {
              asked.push(permission);
              return 'ask';
            },
          },
          openSettings: place => opened.push(place),
        },
      },
      initialUrl: '/settings',
    });

    await fireEvent.press(await screen.findByTestId('settings-permission-contacts'));
    await fireEvent.press(screen.getByTestId('settings-permission-contacts'));

    expect([asked, opened]).toEqual([['contacts', 'contacts'], []]);
  });

  it('open the app’s page in Settings for a permission Android no longer asks for', async () => {
    const phone = fakePhone();
    const opened: string[] = [];
    await renderApp(ROUTES, {
      phone: {
        ...phone,
        ports: {
          ...phone.ports,
          permissions: {
            state: async permission => (permission === 'background-location' ? 'ask' : 'granted'),
            request: async () => 'denied',
          },
          openSettings: place => opened.push(place),
        },
      },
      initialUrl: '/settings',
    });

    await fireEvent.press(await screen.findByTestId('settings-permission-background-location'));
    expect(opened).toEqual([]);
    await fireEvent.press(screen.getByTestId('settings-permission-background-location'));

    expect(opened).toEqual(['app-permissions']);
  });
});
