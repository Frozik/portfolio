import { assert } from '@frozik/utils/assert/assert';
import { trashCard } from '@frozik/vault/model/card-edits';
import { TRASH_RETENTION_DAYS } from '@frozik/vault/model/trash';
import { when } from 'mobx';

import { DEMO_VAULT_PASSWORD } from '../domain/demo-vault';
import { changeCard } from './card-actions';
import { aDevice } from './fake-device.test-helper';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('the trash', () => {
  it('has a card deleted for good by the first unlock after its thirty days', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.startDemo('Demo', key => key);
    await when(
      () =>
        (first.session?.document.cards.size ?? 0) > 0 &&
        first.session?.local.state.phase.kind === 'idle'
    );
    const session = first.session;
    assert(session !== null);
    const vaultKey = session.vaultKey;
    const netflix = [...session.document.cards.values()].find(card => card.title === 'Netflix');
    assert(netflix !== undefined);
    session.transact(changeCard(netflix.id, (card, at) => trashCard(card, at)));
    await when(() => session.local.state.phase.kind === 'idle');
    first.lock('manual');

    device.time.sleep((TRASH_RETENTION_DAYS + 1) * DAY_MS);
    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock(DEMO_VAULT_PASSWORD);
    await when(() => second.session !== null);

    expect(second.session?.document.cards.has(netflix.id)).toBe(false);
    expect(second.session?.document.tombstones.has(`card:${netflix.id}`)).toBe(true);
  });
});
