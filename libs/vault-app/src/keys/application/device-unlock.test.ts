import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

async function enrolledVault() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  const setup = session.flows.deviceUnlockOf();
  assert(setup !== null);
  await setup.check();
  await setup.switchOn(TEST_PASSWORD);
  const vaultKey = session.vaultKey;
  store.lock('manual');
  const next = device.startStore();
  next.choose(vaultKey);
  return { device, store: next, setup, vaultKey };
}

describe('biometric unlock', () => {
  it('is offered on the unlock screen of the vault it holds, and of no other', async () => {
    const { store, vaultKey } = await enrolledVault();

    expect([
      await store.flows.deviceUnlockOffered(vaultKey),
      await store.flows.deviceUnlockOffered('another'),
    ]).toEqual([true, false]);
  });

  it('opens the vault enrolled on this device', async () => {
    const { store, setup } = await enrolledVault();

    store.unlockWithDevice();
    await when(() => store.session !== null);

    expect(setup.state).toEqual({ kind: 'on' });
    expect(store.lifecycle.kind).toBe('unlocked');
  });

  it('leaves the unlock screen as it was when the user closes the prompt', async () => {
    const { device, store } = await enrolledVault();
    device.biometrics.answer('cancel');

    store.unlockWithDevice();
    await when(() => store.lifecycle.kind === 'locked');

    expect(store.lifecycle).toMatchObject({ kind: 'locked', failure: null });
  });

  it('says why and stops offering itself once a new finger was enrolled', async () => {
    const { device, store, vaultKey } = await enrolledVault();
    device.biometrics.enrolNewFinger();

    store.unlockWithDevice();
    await when(() => store.lifecycle.kind === 'locked' && store.lifecycle.failure !== null);

    expect(store.lifecycle).toMatchObject({ failure: 'biometric-invalidated' });
    expect(await device.biometrics.deviceUnlock.isEnrolled(vaultKey)).toBe(false);
  });

  it('is turned off by a key rotation: the suspect key does not stay behind the biometrics', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const { session } = store;
    assert(session !== null);
    const setup = session.flows.deviceUnlockOf();
    assert(setup !== null);
    await setup.switchOn(TEST_PASSWORD);

    await session.rotation.rotate(TEST_PASSWORD);

    expect(await device.biometrics.deviceUnlock.isEnrolled(session.vaultKey)).toBe(false);
  });

  it('says it was turned off, not that the vault is corrupted, when the key it holds is out of date', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const { session } = store;
    assert(session !== null);
    const { vaultKey } = session;
    const setup = session.flows.deviceUnlockOf();
    assert(setup !== null);
    await setup.switchOn(TEST_PASSWORD);
    const outdated = device.biometrics.kept(vaultKey);
    assert(outdated !== undefined);
    await session.rotation.rotate(TEST_PASSWORD);
    device.biometrics.keep(vaultKey, outdated);
    const next = device.startStore();
    next.choose(vaultKey);

    next.unlockWithDevice();
    await when(() => next.lifecycle.kind === 'locked' && next.lifecycle.failure !== null);

    expect(next.lifecycle).toMatchObject({ failure: 'biometric-invalidated' });
    expect(await device.biometrics.deviceUnlock.isEnrolled(vaultKey)).toBe(false);
  });

  it('stays off without a word when the user closes the prompt that would turn it on', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    assert(store.session !== null);
    const setup = store.session.flows.deviceUnlockOf();
    assert(setup !== null);
    await setup.check();
    device.biometrics.answer('cancel');

    await setup.switchOn(TEST_PASSWORD);

    expect(setup.state).toEqual({ kind: 'off' });
  });

  it('turns on only with the master password', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    assert(store.session !== null);
    const setup = store.session.flows.deviceUnlockOf();
    assert(setup !== null);

    await setup.switchOn('not the password');

    expect(setup.state).toEqual({ kind: 'failed', failure: 'wrong-password' });
    expect(device.biometrics.kept(store.session.vaultKey)).toBeUndefined();
  });

  it('is not offered on weak biometrics', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    assert(store.session !== null);
    const setup = store.session.flows.deviceUnlockOf();
    assert(setup !== null);
    device.biometrics.weaken();

    await setup.check();

    expect(setup.state).toEqual({ kind: 'unavailable', biometricClass: 'weak' });
  });
});
