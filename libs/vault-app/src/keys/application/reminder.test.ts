import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';
import { REMINDER_INTERVAL_MS } from '../domain/reminder';

async function biometricVault() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  assert(store.session !== null);
  const vaultKey = store.session.vaultKey;
  const setup = store.session.flows.deviceUnlockOf();
  assert(setup !== null);
  await setup.switchOn(TEST_PASSWORD);
  store.lock('manual');
  return { device, vaultKey };
}

async function openedByBiometrics(device: ReturnType<typeof aDevice>, vaultKey: string) {
  const store = device.startStore();
  store.choose(vaultKey);
  store.unlockWithDevice();
  await when(() => store.session !== null);
  assert(store.session !== null);
  return store.session;
}

describe('the master password reminder', () => {
  it('stays quiet within a week of the password', async () => {
    const { device, vaultKey } = await biometricVault();
    const first = await openedByBiometrics(device, vaultKey);
    await first.deviceSettings.loaded();
    await first.reminder.start(false);

    expect(first.reminder.state).toEqual({ kind: 'quiet' });
  });

  it('asks a week after the password, never instead of the unlock', async () => {
    const { device, vaultKey } = await biometricVault();
    device.time.advance(REMINDER_INTERVAL_MS);

    const session = await openedByBiometrics(device, vaultKey);
    await when(() => session.reminder.state.kind === 'due');

    expect(session.reminder.state).toEqual({ kind: 'due', failure: null });
  });

  it('asks again at the next unlock once dismissed', async () => {
    const { device, vaultKey } = await biometricVault();
    device.time.advance(REMINDER_INTERVAL_MS);
    const first = await openedByBiometrics(device, vaultKey);
    await when(() => first.reminder.state.kind === 'due');

    first.reminder.dismiss();
    expect(first.reminder.state).toEqual({ kind: 'quiet' });
    const next = await openedByBiometrics(device, vaultKey);
    await when(() => next.reminder.state.kind === 'due');

    expect(next.reminder.state.kind).toBe('due');
  });

  it('starts the week over when the password is typed right, and says so when it is wrong', async () => {
    const { device, vaultKey } = await biometricVault();
    device.time.advance(REMINDER_INTERVAL_MS);
    const session = await openedByBiometrics(device, vaultKey);
    await when(() => session.reminder.state.kind === 'due');

    await session.reminder.submit('not the password');
    expect(session.reminder.state).toEqual({ kind: 'due', failure: 'wrong-password' });
    await session.reminder.submit(TEST_PASSWORD);

    expect(session.reminder.state).toEqual({ kind: 'quiet' });
    expect(session.deviceSettings.settings.lastMasterAt).toBe(device.time.clock.now());
  });
});
