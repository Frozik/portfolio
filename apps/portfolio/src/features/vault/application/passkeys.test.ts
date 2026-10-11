import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from './fake-device.test-helper';
import type { VaultFeatureStore } from './VaultFeatureStore';

async function unlocked(device: ReturnType<typeof aDevice>) {
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  return { store, session };
}

async function lockedAgain(
  device: ReturnType<typeof aDevice>,
  store: VaultFeatureStore,
  vaultKey: string
): Promise<VaultFeatureStore> {
  await when(() => store.session?.local.state.phase.kind === 'idle');
  store.dispose();
  const next = device.startStore();
  next.choose(vaultKey);
  return next;
}

describe('passkeys', () => {
  it('are added only after the master password, and then open the vault without it', async () => {
    const device = aDevice();
    const { store, session } = await unlocked(device);
    const flow = store.passkeysOf(session);

    flow.setPassword('not the password');
    await flow.checkPassword();
    expect(flow.step).toEqual({ kind: 'failed', failure: 'wrong-password' });
    flow.setPassword(TEST_PASSWORD);
    await flow.checkPassword();
    await flow.create();
    expect(flow.step).toEqual({ kind: 'added' });
    expect(session.keys.passkeys).toHaveLength(1);

    const locked = await lockedAgain(device, store, session.vaultKey);
    const credentialIds = await locked.passkeysOfLocked(session.vaultKey);
    expect(credentialIds).toHaveLength(1);
    expect(await locked.unlockWithPasskey(session.vaultKey, credentialIds)).toBeNull();
    await when(() => locked.lifecycle.kind !== 'unlocking');
    expect(locked.lifecycle.kind).toBe('unlocked');
  });

  it('leave the vault as it was when the browser’s prompt is declined', async () => {
    const device = aDevice();
    const { store, session } = await unlocked(device);
    const flow = store.passkeysOf(session);
    device.passkeys.answer('cancel');

    flow.setPassword(TEST_PASSWORD);
    await flow.checkPassword();
    await flow.create();

    expect(flow.step).toEqual({ kind: 'failed', failure: 'cancelled' });
    expect(session.keys.passkeys).toEqual([]);
  });

  it('stop opening the vault once removed', async () => {
    const device = aDevice();
    const { store, session } = await unlocked(device);
    const flow = store.passkeysOf(session);
    flow.setPassword(TEST_PASSWORD);
    await flow.checkPassword();
    await flow.create();
    const [passkey] = session.keys.passkeys;
    assert(passkey !== undefined);

    flow.remove(passkey);
    const locked = await lockedAgain(device, store, session.vaultKey);

    expect(await locked.passkeysOfLocked(session.vaultKey)).toEqual([]);
    expect(await locked.unlockWithPasskey(session.vaultKey, [passkey])).toBeNull();
    await when(() => locked.lifecycle.kind !== 'unlocking');
    expect(locked.lifecycle).toMatchObject({ kind: 'locked', failure: 'wrong-password' });
  });
});
