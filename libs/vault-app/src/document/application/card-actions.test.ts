import { assert } from '@frozik/utils/assert/assert';
import { addToGroup, renameCard, setFavorite, trashCard } from '@frozik/vault/model/card-edits';
import { linkedCardIds } from '@frozik/vault/model/link-edits';
import { when } from 'mobx';

import type { VaultSession } from '../../session/application/VaultSession';
import { aDevice } from '../../testing/fake-device';
import { DEMO_VAULT_PASSWORD } from '../domain/demo-vault';
import { changeCard, duplicate, link, newGroup, purge, restore, unlink } from './card-actions';

async function demo(): Promise<VaultSession> {
  const store = aDevice().startStore();
  store.startDemo('Demo', key => key);
  await when(() => (store.session?.document.cards.size ?? 0) > 0);
  assert(store.session !== null);
  return store.session;
}

function cardTitled(session: VaultSession, title: string) {
  const card = [...session.document.cards.values()].find(candidate => candidate.title === title);
  assert(card !== undefined);
  return card;
}

describe('card actions', () => {
  it('stars a card and files it into a new group, straight into the vault', async () => {
    const session = await demo();
    const amazon = cardTitled(session, 'Amazon');

    const groupId = session.transact(newGroup('Shopping', session.random));
    assert(groupId !== null);
    session.transact(changeCard(amazon.id, card => addToGroup(setFavorite(card, true), groupId)));

    expect(session.document.cards.get(amazon.id)?.favorite).toBe(true);
    expect(session.view.countOf(groupId)).toBe(1);
  });

  it('duplicates a card under a new title and new ids', async () => {
    const session = await demo();
    const github = cardTitled(session, 'GitHub');

    const copyId = session.transact(duplicate(github.id, 'GitHub (copy)', session.random));
    assert(copyId !== null);

    expect(session.document.cards.get(copyId)?.title).toBe('GitHub (copy)');
    expect(copyId).not.toBe(github.id);
  });

  it('moves a card to the trash and deletes it for good from there', async () => {
    const session = await demo();
    const netflix = cardTitled(session, 'Netflix');

    session.transact(changeCard(netflix.id, (card, at) => trashCard(card, at)));
    expect(session.view.countOf('trash')).toBe(1);
    session.transact(purge(netflix.id));

    expect(session.document.cards.has(netflix.id)).toBe(false);
    expect(session.document.tombstones.has(`card:${netflix.id}`)).toBe(true);
  });

  it('opens protected cards only with the master password', async () => {
    const session = await demo();

    expect(await session.openProtected('not the password')).toBe('wrong-password');
    expect(session.protectedGate.isOpen).toBe(false);
    expect(await session.openProtected(DEMO_VAULT_PASSWORD)).toBeNull();
    expect(session.protectedGate.isOpen).toBe(true);
  });

  it('brings back an earlier version as a new edit, keeping the current one in history', async () => {
    const session = await demo();
    const github = cardTitled(session, 'GitHub');
    session.transact(changeCard(github.id, card => renameCard(card, 'GitHub (renamed)')));
    const renamed = session.document.cards.get(github.id);
    assert(renamed !== undefined);
    const [previous] = renamed.history;
    assert(previous !== undefined);

    session.transact(restore(github.id, previous.at));

    const restored = session.document.cards.get(github.id);
    expect(restored?.title).toBe('GitHub');
    expect(restored?.history[0]?.snapshot.title).toBe('GitHub (renamed)');
  });

  it('links two cards both ways and unlinks them', async () => {
    const session = await demo();
    const amazon = cardTitled(session, 'Amazon');
    const visa = cardTitled(session, 'Visa Classic');

    session.transact(link(amazon.id, visa.id));
    expect(linkedCardIds(session.document, visa.id)).toContain(amazon.id);

    session.transact(unlink(visa.id, amazon.id));
    expect(linkedCardIds(session.document, amazon.id)).toEqual([]);
  });
});
