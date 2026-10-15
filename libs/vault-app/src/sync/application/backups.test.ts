import { assert } from '@frozik/utils/assert/assert';
import type { IVaultCard } from '@frozik/vault/model/card';
import { renameCard } from '@frozik/vault/model/card-edits';
import { commitCard } from '@frozik/vault/model/revision-edits';
import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import type { VaultSession } from '../../session/application/VaultSession';
import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

function addCard(session: VaultSession, card: IVaultCard): void {
  session.apply(document => ({
    ...document,
    cards: new Map([...document.cards, [card.id, card]]),
  }));
}

function rename(session: VaultSession, card: IVaultCard, title: string): void {
  session.apply((document, at) => {
    const current = document.cards.get(card.id);
    assert(current !== undefined);
    return {
      ...document,
      cards: new Map(document.cards).set(
        card.id,
        commitCard(current, renameCard(current, title), at)
      ),
    };
  });
}

async function aSession() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Home', TEST_PASSWORD);
  await when(() => store.session !== null);
  const session = store.session;
  assert(session !== null);
  await when(() => session.local.state.phase.kind === 'idle');
  return { device, session };
}

async function backupsOf(session: VaultSession) {
  await session.backups.refresh();
  const { value } = session.backups.entries;
  assert(value !== undefined && value !== null);
  return value;
}

describe('backups of the vault on this device', () => {
  it('rolls the vault back to a backup and keeps the version before the rollback', async () => {
    const { session } = await aSession();
    const card = aCard({ title: 'Bank' });
    addCard(session, card);
    await when(() => session.local.state.phase.kind === 'idle');
    await session.backups.keep('periodic');
    const later = aCard({ title: 'Made later' });
    rename(session, card, 'Bank (changed)');
    addCard(session, later);
    await when(() => session.local.state.phase.kind === 'idle');
    const [backup] = await backupsOf(session);
    assert(backup !== undefined);

    const outcome = await session.backups.restore(backup.id);

    expect(outcome).toEqual({ kind: 'restored', summary: { restored: 1, revived: 0, trashed: 1 } });
    expect(session.document.cards.get(card.id)?.title).toBe('Bank');
    expect(session.document.cards.get(later.id)?.trashedAt).not.toBeNull();
    expect((await backupsOf(session))[0]?.reason).toBe('before-restore');
  });

  it('keeps only as many backups as this device was asked to', async () => {
    const { session } = await aSession();
    session.deviceSettings.update({ backupsKept: 2 });

    for (let index = 0; index < 4; index += 1) {
      await session.backups.keep('periodic');
    }

    expect(await backupsOf(session)).toHaveLength(2);
  });
});
