import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

async function openVault() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  return { store, session, setup: session.flows.quickUnlockOf() };
}

describe('setting up quick unlock', () => {
  it('asks for the master password before anything else', async () => {
    const { setup } = await openVault();

    await setup.checkPassword('not the password');

    expect(setup.step).toEqual({ kind: 'password', failure: 'wrong-password' });
  });

  it('takes a PIN typed twice, and the vault may then lock quickly', async () => {
    const { store, setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);

    setup.choose('pin');
    setup.enter('2468');
    setup.confirm('2468');
    await when(() => store.lifecycle.kind === 'unlocked' && store.lifecycle.quickReady);

    expect(setup.step).toEqual({ kind: 'done' });
    expect(setup.enabled).toBe('pin');
  });

  it('forgets the checked password when the setup is left, so it is asked again', async () => {
    const { setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);

    setup.cancel();
    setup.choose('first-four');

    expect(setup.step).toEqual({ kind: 'password', failure: null });
    expect(setup.enabled).toBeNull();
  });

  it('starts over when the confirmation differs', async () => {
    const { setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);

    setup.choose('pattern');
    setup.enter([0, 1, 2, 5]);
    setup.confirm([0, 1, 2, 4]);

    expect(setup.step).toEqual({ kind: 'enter', method: 'pattern', problem: 'mismatch' });
  });

  it('refuses a pattern of fewer than four points', async () => {
    const { setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);

    setup.choose('pattern');
    setup.enter([0, 1]);

    expect(setup.step).toEqual({ kind: 'enter', method: 'pattern', problem: 'too-short' });
  });

  it('takes the first four characters of a master password long enough to spare them', async () => {
    const { session, setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);

    setup.choose('first-four');

    expect(setup.masterCharactersOffered).toBe(true);
    expect(session.deviceSettings.settings.quickUnlock?.code).toBe('first-four:corr');
  });

  it('is switched off on request, and the next idle lock is full again', async () => {
    const { store, setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);
    setup.choose('pin');
    setup.enter('2468');
    setup.confirm('2468');
    await when(() => store.lifecycle.kind === 'unlocked' && store.lifecycle.quickReady);

    setup.switchOff();

    await when(() => store.lifecycle.kind === 'unlocked' && !store.lifecycle.quickReady);
    expect(setup.enabled).toBeNull();
  });

  it('is dropped when the master password changes on this device', async () => {
    const { session, setup } = await openVault();
    await setup.checkPassword(TEST_PASSWORD);
    setup.choose('pin');
    setup.enter('2468');
    setup.confirm('2468');

    expect(
      await session.keys.change(
        { kind: 'password', password: TEST_PASSWORD },
        'a new long password'
      )
    ).toBeNull();
    expect(session.deviceSettings.settings.quickUnlock).toBeNull();
  });
});
