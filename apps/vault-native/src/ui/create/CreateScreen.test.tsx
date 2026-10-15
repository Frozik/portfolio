import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { View } from 'react-native';

import { TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { renderApp } from '../testing/render-app';
import { CreateScreen } from './CreateScreen';

const ROUTES = {
  index: () => <View testID="start" />,
  new: () => <CreateScreen inCloud={false} />,
  '[vaultId]': () => <View testID="vault" />,
};

async function fillIn(password: string, confirmation: string): Promise<void> {
  await fireEvent.changeText(screen.getByTestId('create-name'), 'Family');
  await fireEvent.changeText(screen.getByTestId('create-password'), password);
  await fireEvent.changeText(screen.getByTestId('create-confirmation'), confirmation);
  await fireEvent.press(screen.getByTestId('create-acknowledged'));
}

describe('creating a vault', () => {
  it('opens the new vault in place of the form', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/new' });
    await fillIn(TEST_PASSWORD, TEST_PASSWORD);

    await fireEvent.press(screen.getByTestId('create-submit'));

    await waitFor(() => expect(screen.getByTestId('vault')).toBeOnTheScreen());
    expect(rendered.getPathname()).toBe(`/${rendered.app.session?.vaultKey}`);
  });

  it('keeps Create off while the two passwords differ', async () => {
    await renderApp(ROUTES, { initialUrl: '/new' });

    await fillIn(TEST_PASSWORD, `${TEST_PASSWORD}!`);

    expect(screen.getByTestId('create-submit')).toBeDisabled();
  });

  it('cancels to the start when nothing came before it', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/new' });

    await fireEvent.press(screen.getByTestId('create-cancel'));

    await waitFor(() => expect(rendered.getPathname()).toBe('/'));
  });
});
