import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import type { VaultSession } from '../../session/application/VaultSession';
import { aDevice } from '../../testing/fake-device';
import { DEMO_VAULT_PASSWORD } from '../domain/demo-vault';
import { changeProtection } from './card-protection';

async function demo(): Promise<VaultSession> {
  const store = aDevice().startStore();
  store.startDemo('Demo', key => key);
  await when(() => (store.session?.document.cards.size ?? 0) > 0);
  assert(store.session !== null);
  return store.session;
}

function protectedCard(session: VaultSession) {
  const card = [...session.document.cards.values()].find(candidate => candidate.protected);
  assert(card !== undefined);
  return card;
}

describe('a card’s protection', () => {
  it('stays on without the master password typed again', async () => {
    const session = await demo();
    const card = protectedCard(session);

    expect(changeProtection(session, card.id, false)).toBe('password-needed');
    expect(session.document.cards.get(card.id)?.protected).toBe(true);
  });

  it('comes off once protected cards were opened with the master password', async () => {
    const session = await demo();
    const card = protectedCard(session);

    await session.openProtected(DEMO_VAULT_PASSWORD);

    expect(changeProtection(session, card.id, false)).toBe('done');
    expect(session.document.cards.get(card.id)?.protected).toBe(false);
  });

  it('goes on at any time', async () => {
    const session = await demo();
    const open = [...session.document.cards.values()].find(candidate => !candidate.protected);
    assert(open !== undefined);

    expect(changeProtection(session, open.id, true)).toBe('done');
    expect(session.document.cards.get(open.id)?.protected).toBe(true);
  });
});
