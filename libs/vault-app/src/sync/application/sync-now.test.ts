import { assert } from '@frozik/utils/assert/assert';
import type { IVaultCard } from '@frozik/vault/model/card';
import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import type { VaultApp } from '../../session/application/VaultApp';
import { aCloud, aDevice, linkedToWebDav, openedFromTheCloud } from '../../testing/fake-device';

function addCard(store: VaultApp, card: IVaultCard): void {
  store.session?.apply(document => ({
    ...document,
    cards: new Map([...document.cards, [card.id, card]]),
  }));
}

describe('syncing on request', () => {
  it('takes what another device wrote and sends its own edit back, without waiting', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const second = await openedFromTheCloud(aDevice({ cloud, seed: 8 }));
    const theirs = aCard({ title: 'Mail' });
    const mine = aCard({ title: 'Bank' });

    addCard(second, theirs);
    second.session?.cloud.syncNow();
    await when(() => second.session?.cloud.status.kind === 'synced');
    addCard(first.store, mine);
    first.store.session?.cloud.syncNow();
    await when(() => first.store.session?.document.cards.has(theirs.id) === true);
    await when(() => first.store.session?.cloud.status.kind === 'synced');
    second.session?.cloud.syncNow();
    await when(() => second.session?.document.cards.has(mine.id) === true);

    const session = first.store.session;
    assert(session !== null);
    expect(session.document.cards.has(mine.id)).toBe(true);
    expect(second.session?.document.cards.has(theirs.id)).toBe(true);
  });
});
