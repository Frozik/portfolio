import type { Milliseconds } from '@frozik/utils/date/types';
import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import type { IQuickUnlockSetting } from '../../keys/domain/quick-code';
import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';
import type { VaultApp } from './VaultApp';

const LIFETIME_MS = (4 * 60 * 60 * 1000) as Milliseconds;
const PIN = 'pin:1234';

async function quickReadyVault(
  setting: Pick<IQuickUnlockSetting, 'kind' | 'code'> = { kind: 'pin', code: PIN }
) {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  store.session?.deviceSettings.update({
    quickUnlock: { ...setting, lifetimeMs: LIFETIME_MS, hideLine: false, keepOverRestart: true },
  });
  await when(() => store.lifecycle.kind === 'unlocked' && store.lifecycle.quickReady);
  return { device, store };
}

function lockedLevel(store: VaultApp): string | null {
  return store.lifecycle.kind === 'locked' ? store.lifecycle.level : null;
}

describe('quick unlock', () => {
  it('locks an idle vault quickly, without a reload, and the code opens it as it was', async () => {
    const { device, store } = await quickReadyVault();
    const card = aCard({ title: 'Bank' });
    store.session?.apply(document => ({ ...document, cards: new Map([[card.id, card]]) }));
    await when(() => store.session?.local.state.phase.kind === 'idle');

    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');
    const prompt = store.quick.prompt;
    store.quick.attempt('1234');
    await when(() => store.session !== null);

    expect(prompt).toEqual({ kind: 'pin', digits: 4 });
    expect(store.quick.prompt).toBeNull();
    expect(device.reloads()).toBe(0);
    expect(store.session?.document.cards.has(card.id)).toBe(true);
  });

  it('gives one try: a wrong code locks fully, wipes, and the right one no longer opens', async () => {
    const { device, store } = await quickReadyVault();

    store.lock('concealed');
    await when(() => lockedLevel(store) === 'quick');
    store.quick.attempt('0000');
    await when(() => lockedLevel(store) === 'full');
    store.quick.attempt('1234');

    expect(store.lifecycle).toMatchObject({ kind: 'locked', reason: 'quick-unlock-failed' });
    expect(device.reloads()).toBe(1);
    expect(store.session).toBeNull();
  });

  it('tells the page after the wipe why the master password is asked for', async () => {
    const { device, store } = await quickReadyVault();
    const vaultKey = store.session?.vaultKey ?? '';
    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');
    store.quick.attempt('0000');
    await when(() => lockedLevel(store) === 'full');

    const reloaded = device.startStore();
    reloaded.choose(vaultKey);

    expect(reloaded.lifecycle).toMatchObject({ kind: 'locked', reason: 'quick-unlock-failed' });
  });

  it('becomes a full lock once its lifetime is over', async () => {
    const { device, store } = await quickReadyVault();

    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');
    device.time.advance(LIFETIME_MS);

    expect(store.lifecycle).toMatchObject({
      kind: 'locked',
      level: 'full',
      reason: 'quick-expired',
    });
    expect(device.reloads()).toBe(1);
  });

  it('locks quickly on the lock button once quick unlock is ready, keeping the process', async () => {
    const { device, store } = await quickReadyVault();

    store.lock('manual');

    await when(() => lockedLevel(store) === 'quick');
    expect(device.reloads()).toBe(0);
  });

  it('locks fully when asked to lock completely, even with quick unlock ready', async () => {
    const { device, store } = await quickReadyVault();

    store.lock('complete');

    await when(() => lockedLevel(store) === 'full');
    expect(device.reloads()).toBe(1);
  });

  it('is ready again after a quick unlock, so the next idle lock is quick too', async () => {
    const { device, store } = await quickReadyVault();

    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');
    store.quick.attempt('1234');
    await when(() => store.lifecycle.kind === 'unlocked' && store.lifecycle.quickReady);
    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');

    expect(device.reloads()).toBe(0);
  });

  it('takes the first four characters again from the master password typed at the unlock', async () => {
    const { device, store } = await quickReadyVault({
      kind: 'first-four',
      code: 'first-four:old!',
    });
    const vaultKey = store.session?.vaultKey ?? '';
    store.lock('complete');
    await when(() => lockedLevel(store) === 'full');

    const next = device.startStore();
    next.choose(vaultKey);
    next.unlock(TEST_PASSWORD);
    await when(() => next.session?.deviceSettings.settings.quickUnlock?.code === 'first-four:corr');

    expect(next.session?.deviceSettings.settings.quickUnlock?.code).toBe('first-four:corr');
  });
});

describe('the quick lock screen', () => {
  it('does not spend the one try on a pattern too short to be one', async () => {
    const { store } = await quickReadyVault({ kind: 'pattern', code: 'pattern:0-1-2-5' });
    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');

    expect(store.quick.attempt([0, 1])).toBe('too-short');
    expect(store.lifecycle).toMatchObject({ kind: 'locked', level: 'quick' });
    expect(store.quick.attempt([0, 1, 2, 5])).toBeNull();
    await when(() => store.session !== null);
  });

  it('takes the right pattern drawn on back to a point it joined as another code: the one try', async () => {
    const { store } = await quickReadyVault({ kind: 'pattern', code: 'pattern:0-1-2-5' });
    store.lock('idle');
    await when(() => lockedLevel(store) === 'quick');

    expect(store.quick.attempt([0, 1, 2, 5, 1])).toBeNull();
    await when(() => lockedLevel(store) === 'full');
    expect(store.session).toBeNull();
  });
});
