import 'fake-indexeddb/auto';

import { assert } from '@frozik/utils/assert/assert';

import { cardState } from '../model/revision-edits';
import { createIndexedDbDeviceStores } from '../persistence/indexeddb/device-stores';
import type { TVaultKey } from '../persistence/ports';
import { aCardWith, aField } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { aVault } from '../testing/vault-file-fixtures';
import { createDraftRecord } from './draft-record';

const VAULT = 'vault-a' as TVaultKey;
let database = 0;

async function aRecord() {
  const { keys } = await aVault();
  const random = createSeededRandom(5);
  const stores = createIndexedDbDeviceStores(random, `pwv:draft-test-${(database += 1)}`);
  const record = createDraftRecord({
    store: stores.drafts,
    vaultKey: VAULT,
    dek: keys.dek,
    random,
  });
  return { record, stores, keys, random };
}

describe('draft record', () => {
  it('gives back the edit in progress after the next unlock, and nothing once cleared', async () => {
    const { record } = await aRecord();
    const base = cardState(
      aCardWith([aField({ kind: 'password', rotateEveryDays: null }, 'old-secret')], {
        title: 'Bank',
      })
    );
    const draft = { kind: 'edit' as const, base, card: { ...base, title: 'Bank (new)' } };

    await record.save(draft);
    expect(await record.load()).toEqual(draft);

    await record.clear();
    expect(await record.load()).toBeNull();
  });

  it('stores nothing of the card in the clear', async () => {
    const { record, stores } = await aRecord();
    const card = cardState(
      aCardWith([aField({ kind: 'password', rotateEveryDays: null }, 'hunter2-secret')], {
        title: 'Private bank',
      })
    );

    await record.save({ kind: 'new', card });
    const sealed = await stores.drafts.get(VAULT, 'card-draft');

    assert(sealed.ok && sealed.value !== null);
    const asText = new TextDecoder().decode(sealed.value);
    expect(asText).not.toContain('hunter2-secret');
    expect(asText).not.toContain('Private bank');
  });

  it('opens nothing for another vault key', async () => {
    const { record, stores, random } = await aRecord();
    const { keys: otherKeys } = await aVault(2);
    await record.save({ kind: 'new', card: cardState(aCardWith([], { title: 'Bank' })) });

    const other = createDraftRecord({
      store: stores.drafts,
      vaultKey: VAULT,
      dek: otherKeys.dek,
      random,
    });

    expect(await other.load()).toBeNull();
  });

  it('lets a clear issued while a save is sealing win, so a saved card is not offered again', async () => {
    const { record } = await aRecord();
    const card = cardState(aCardWith([], { title: 'Bank' }));

    const saving = record.save({ kind: 'new', card });
    const clearing = record.clear();
    await Promise.all([saving, clearing]);

    expect(await record.load()).toBeNull();
  });
});
