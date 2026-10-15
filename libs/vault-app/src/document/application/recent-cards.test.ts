import { assert } from '@frozik/utils/assert/assert';
import { archiveCard, putCard } from '@frozik/vault/model/card-edits';
import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

const FIRST = aCard({ title: 'Bank' });
const SECOND = aCard({ title: 'Mail' });

async function openVault(device = aDevice()) {
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  session.apply(document => putCard(putCard(document, FIRST), SECOND));
  await when(() => session.local.state.phase.kind === 'idle');
  return { device, store, session };
}

async function unlockedAgain(device: ReturnType<typeof aDevice>, vaultKey: string) {
  const store = device.startStore();
  store.choose(vaultKey);
  store.unlock(TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  await session.recent.load();
  return session;
}

describe('the cards opened lately on this device', () => {
  it('lists the last opened first, each once', async () => {
    const { session } = await openVault();

    session.recent.opened(FIRST.id);
    session.recent.opened(SECOND.id);
    session.recent.opened(FIRST.id);

    expect(session.recent.cards.map(card => card.title)).toEqual(['Bank', 'Mail']);
  });

  it('are still there after a lock, sealed on this device', async () => {
    const { device, store, session } = await openVault();
    session.recent.opened(SECOND.id);
    session.recent.opened(FIRST.id);
    await session.recent.saved();
    store.lock('manual');

    const again = await unlockedAgain(device, session.vaultKey);

    expect(again.recent.cards.map(card => card.title)).toEqual(['Bank', 'Mail']);
  });

  it('drop a card once it is archived', async () => {
    const { session } = await openVault();
    session.recent.opened(FIRST.id);
    session.recent.opened(SECOND.id);

    session.apply((document, at) => {
      const card = document.cards.get(SECOND.id);
      return card === undefined
        ? document
        : putCard(document, { ...card, ...archiveCard(card, at) });
    });

    expect(session.recent.cards.map(card => card.title)).toEqual(['Bank']);
  });

  it('survive a key rotation', async () => {
    const { device, session } = await openVault();
    session.recent.opened(FIRST.id);
    await session.recent.saved();

    await session.rotation.rotate(TEST_PASSWORD);
    const again = await unlockedAgain(device, session.vaultKey);

    expect(again.recent.cards.map(card => card.title)).toEqual(['Bank']);
  });
});
