import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';
import type { VaultApp } from './VaultApp';

const PIN = '2468';
const HOUR_MS = 60 * 60 * 1000;

/** A phone's vault with a PIN set up through the settings, the way a user sets it. */
async function phoneWithPin() {
  const device = aDevice({ keepsQuickLocks: true });
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const session = store.session;
  assert(session !== null);
  const setup = session.flows.quickUnlockOf();
  await setup.checkPassword(TEST_PASSWORD);
  setup.choose('pin');
  setup.enter(PIN);
  setup.confirm(PIN);
  await vi.waitFor(() => expect(device.keptQuickLocks.has(session.vaultKey)).toBe(true));
  return { device, store, vaultKey: session.vaultKey };
}

/** The app is started again, as Android does after it ended the process. */
function restarted(device: ReturnType<typeof aDevice>, vaultKey: string): VaultApp {
  const store = device.startStore();
  store.choose(vaultKey);
  return store;
}

function lockedLevel(store: VaultApp): string | null {
  return store.lifecycle.kind === 'locked' ? store.lifecycle.level : null;
}

describe('a quick lock kept across a restart, as a phone keeps it', () => {
  it('asks for the PIN after a restart and opens with it, the master password not needed', async () => {
    const { device, vaultKey } = await phoneWithPin();

    const store = restarted(device, vaultKey);
    const asked = { level: lockedLevel(store), prompt: store.quick.prompt };
    store.quick.attempt(PIN);
    await when(() => store.session !== null);

    expect(asked).toEqual({ level: 'quick', prompt: { kind: 'pin', digits: 4 } });
  });

  it('gives the one try after a restart: a wrong PIN leaves only the master password', async () => {
    const { device, vaultKey } = await phoneWithPin();
    const store = restarted(device, vaultKey);

    store.quick.attempt('1111');
    await when(() => lockedLevel(store) === 'full');

    expect(device.keptQuickLocks.has(vaultKey)).toBe(false);
    expect(lockedLevel(restarted(device, vaultKey))).toBe('full');
  });

  it('keeps the PIN again once the master password opened the vault', async () => {
    const { device, vaultKey } = await phoneWithPin();
    const store = restarted(device, vaultKey);
    store.quick.attempt('1111');
    await when(() => lockedLevel(store) === 'full');

    const next = restarted(device, vaultKey);
    next.unlock(TEST_PASSWORD);
    await when(() => next.session !== null);
    await vi.waitFor(() => expect(device.keptQuickLocks.has(vaultKey)).toBe(true));

    expect(lockedLevel(restarted(device, vaultKey))).toBe('quick');
  });

  it('keeps nothing after locking completely', async () => {
    const { device, store, vaultKey } = await phoneWithPin();

    store.lock('complete');
    await when(() => lockedLevel(store) === 'full');

    expect(lockedLevel(restarted(device, vaultKey))).toBe('full');
  });

  it('keeps nothing when the master password is asked for after a restart', async () => {
    const { device, store, vaultKey } = await phoneWithPin();
    const setting = store.session?.deviceSettings.settings.quickUnlock;
    assert(setting !== null && setting !== undefined);

    store.session?.deviceSettings.update({ quickUnlock: { ...setting, keepOverRestart: false } });

    expect(lockedLevel(restarted(device, vaultKey))).toBe('full');
  });

  it('ends with its lifetime: a restart after it asks for the master password', async () => {
    const { device, vaultKey } = await phoneWithPin();

    device.time.advance(13 * HOUR_MS);

    expect(lockedLevel(restarted(device, vaultKey))).toBe('full');
  });

  it('is not kept on a platform that keeps nothing across a restart', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const vaultKey = store.session?.vaultKey ?? '';

    expect(lockedLevel(restarted(device, vaultKey))).toBe('full');
  });
});
