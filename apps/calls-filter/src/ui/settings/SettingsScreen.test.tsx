import { screen } from 'expo-router/testing-library';

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
});
