import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import { aDevice } from '../../testing/fake-device';
import { createFakeLockSignals } from '../../testing/fake-lock-signals';

const PASSWORD = 'correct horse battery staple';
describe('VaultApp', () => {
  it('gives the open vault’s key to the platform’s custody and takes it back at the lock', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Home', PASSWORD);
    await when(() => store.session !== null);

    expect(device.heldKey()?.vaultKey).toBe(store.session?.vaultKey);
    store.lock('manual');
    await when(() => device.heldKey() === null);
    expect(device.heldKey()).toBeNull();
  });

  it('creates a vault, keeps an edit through a lock and a reload, and opens it with the password', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey;
    const card = aCard({ title: 'Bank' });

    first.session?.apply(document => ({
      ...document,
      cards: new Map([...document.cards, [card.id, card]]),
    }));
    await when(() => first.session?.local.state.phase.kind === 'idle');
    first.lock('manual');

    expect(first.session).toBeNull();
    expect(device.reloads()).toBe(1);

    const second = device.startStore();
    await second.registry.refresh();
    second.choose(vaultKey ?? '');
    second.unlock(PASSWORD);
    await when(() => second.session !== null);

    expect(second.registry.vaults.value?.map(vault => vault.name)).toEqual(['Home']);
    expect(second.session?.document.cards.get(card.id)?.title).toBe('Bank');
  });

  it('refuses a wrong password and stays locked with the reason', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey ?? '';
    first.dispose();

    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock('wrong');
    await when(() => second.lifecycle.kind === 'locked' && second.lifecycle.failure !== null);

    expect(second.lifecycle).toMatchObject({ kind: 'locked', failure: 'wrong-password' });
    expect(second.session).toBeNull();
  });

  it('locks when the page goes into the back/forward cache and back, and reloads', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Home', PASSWORD);
    await when(() => store.session !== null);

    device.signals.resume();

    expect(store.session).toBeNull();
    expect(device.reloads()).toBe(1);
  });

  it('locks the other tabs when the user locks, but not when one tab locks on its own', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey ?? '';
    const otherPage = createFakeLockSignals();
    const second = device.startStore(otherPage);
    second.choose(vaultKey ?? '');
    second.unlock(PASSWORD);
    await when(() => second.session !== null);

    otherPage.unload();
    expect(second.session).toBeNull();
    expect(first.session).not.toBeNull();

    const third = device.startStore(createFakeLockSignals());
    third.choose(vaultKey ?? '');
    third.unlock(PASSWORD);
    await when(() => third.session !== null);
    third.lock('manual');

    expect(first.session).toBeNull();
  });

  it('opens the demo with its shown password and the made-up cards already in it', async () => {
    const device = aDevice();
    const store = device.startStore();

    store.startDemo('Demo', key => key);
    await when(
      () => (store.session?.document.cards.size ?? 0) > 0 && store.registry.vaults.value !== null
    );

    expect(store.registry.vaults.value?.map(vault => vault.name)).toEqual(['Demo']);
    expect(store.session?.document.cards.size).toBeGreaterThan(10);
  });

  it('renames and describes the vault in the vault itself and in the device list', async () => {
    const store = aDevice().startStore();
    store.create('Home', PASSWORD);
    await when(() => store.session !== null);

    await store.renameVault({ name: 'Family', description: 'Shared with the kids' });

    expect(store.session?.document.settings).toMatchObject({
      name: 'Family',
      description: 'Shared with the kids',
    });
    expect(
      store.registry.vaults.value?.map(({ name, description }) => ({ name, description }))
    ).toEqual([{ name: 'Family', description: 'Shared with the kids' }]);
  });

  it('forgets a vault from the list without opening it, leaving the open one as it is', async () => {
    const device = aDevice();
    const home = device.startStore();
    home.create('Home', PASSWORD);
    await when(() => home.session !== null);
    const homeKey = home.session?.vaultKey ?? '';
    home.lock('left');
    const store = device.startStore();
    store.create('Work', PASSWORD);
    await when(() => store.session !== null);

    await store.forgetVault(homeKey);

    expect(store.registry.vaults.value?.map(vault => vault.name)).toEqual(['Work']);
    expect(store.session?.document.settings.name).toBe('Work');
  });

  it('forgets a vault on this device: the list no longer has it and it cannot be opened', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey ?? '';

    await first.forgetVault();

    const second = device.startStore();
    await second.registry.refresh();
    second.choose(vaultKey);
    second.unlock(PASSWORD);
    await when(() => second.lifecycle.kind === 'locked' && second.lifecycle.failure !== null);
    expect(second.registry.vaults.value).toEqual([]);
    expect(second.lifecycle).toMatchObject({ failure: 'not-found' });
  });
});
