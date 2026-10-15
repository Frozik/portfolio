import { assert } from '@frozik/utils/assert/assert';
import { aCard } from '@frozik/vault/testing/builders';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { when } from 'mobx';

import { CLOUD_PUSH_DEBOUNCE_MS } from '@frozik/vault-app/cloud/application/CloudLink';
import {
  aCloud,
  aDevice,
  linkedToWebDav,
  openedFromTheCloud,
  TEST_PASSWORD,
} from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';

describe('what an open vault on the phone is told about its keys', () => {
  it('asks for the password to follow a key changed on another device, then locks under it', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const phone = aDevice({ cloud, seed: 8 });
    const joined = await openedFromTheCloud(phone);
    const vaultKey = joined.session?.vaultKey ?? '';
    joined.lock('manual');
    joined.dispose();
    const { app } = await renderApp(OPEN_VAULT_ROUTES, {
      device: phone,
      initialUrl: `/${vaultKey}`,
    });
    await act(() => app.registry.refresh());
    await fireEvent.changeText(await screen.findByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));
    await screen.findByTestId('card-list-screen');
    await act(() => when(() => app.session?.cloud.status.kind === 'synced'));

    await act(() => first.store.session?.rotation.rotate(TEST_PASSWORD));
    const card = aCard({ title: 'Made meanwhile' });
    await act(() => {
      app.session?.apply(document => ({
        ...document,
        cards: new Map([...document.cards, [card.id, card]]),
      }));
      phone.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    });
    await fireEvent.press(await screen.findByTestId('key-rotated-follow'));
    await fireEvent.changeText(await screen.findByTestId('key-rotated-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('key-rotated-submit'));

    await waitFor(() => expect(app.lifecycle.kind).not.toBe('unlocked'));
  });

  it('says a vault opened with the recovery key needs a new password, and leads to the settings', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const session = maker.session;
    assert(session !== null);
    const flow = session.flows.recoveryKeyOf(() =>
      Promise.resolve({ name: 'kit.txt', mime: 'text/plain', bytes: Uint8Array.of(1) })
    );
    flow.start();
    const { step } = flow;
    assert(step.kind === 'shown');
    flow.toConfirmation();
    flow.setLastGroup(step.formatted.split('-').at(-1)?.toLowerCase() ?? '');
    flow.setPassword(TEST_PASSWORD);
    await flow.confirm();
    await when(() => session.local.state.phase.kind === 'idle');
    const { vaultKey } = session;
    maker.lock('manual');
    const rendered = await renderApp(OPEN_VAULT_ROUTES, { device, initialUrl: `/${vaultKey}` });
    await act(() => rendered.app.registry.refresh());
    await fireEvent.press(await screen.findByTestId('use-recovery-key'));
    await fireEvent.changeText(screen.getByTestId('recovery-key'), step.formatted);
    await fireEvent.press(screen.getByTestId('recovery-submit'));

    await fireEvent.press(await screen.findByTestId('recovering-set-password'));

    await waitFor(() => expect(rendered.getPathname()).toBe(`/${vaultKey}/settings`));
  });
});
