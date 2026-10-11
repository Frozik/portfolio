import { assert } from '@frozik/utils/assert/assert';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { renameCard } from '@frozik/vault/model/card-edits';
import { concurrentVersions } from '@frozik/vault/model/card-versions';
import { setFieldValue } from '@frozik/vault/model/field-edits';
import type { TCardId } from '@frozik/vault/model/ids';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import { changeCard, resolveConcurrent } from './card-actions';
import { CLOUD_PUSH_DEBOUNCE_MS } from './CloudLink';
import { aCloud, aDevice, linkedToWebDav, openedFromTheCloud } from './fake-device.test-helper';
import type { VaultFeatureStore } from './VaultFeatureStore';

async function synced(store: VaultFeatureStore, device: ReturnType<typeof aDevice>): Promise<void> {
  store.session?.cloud.requestPush();
  device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
  await when(() => store.session?.cloud.status.kind === 'synced');
}

describe('versions made at the same time on two devices', () => {
  it('are combined into one card that keeps both edits, on both devices', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const secondDevice = aDevice({ cloud, seed: 8 });
    const login = aField({ kind: 'login' }, 'jane');
    const card = aCardWith([login], { title: 'Bank' });
    first.store.session?.apply((document, at) => ({
      ...document,
      cards: new Map([...document.cards, [card.id, { ...card, createdAt: at, updatedAt: at }]]),
    }));
    await synced(first.store, first.device);
    const second = await openedFromTheCloud(secondDevice);

    first.store.session?.transact(changeCard(card.id, state => renameCard(state, 'Bank (main)')));
    second.session?.transact(
      changeCard(card.id, state =>
        setFieldValue(state, login.id, { cardinality: 'single', value: 'jane.doe' })
      )
    );
    await synced(first.store, first.device);
    await synced(second, secondDevice);
    const merged = second.session?.document.cards.get(card.id);
    assert(merged !== undefined);
    expect(concurrentVersions(merged)).toHaveLength(1);

    const [other] = concurrentVersions(merged);
    assert(other !== undefined);
    second.session?.transact(
      resolveConcurrent(card.id, { kind: 'combine', version: other.at, choices: new Map() })
    );
    await synced(second, secondDevice);
    first.device.page.setHidden(true);
    first.device.page.setHidden(false);
    await when(() => first.store.session?.cloud.status.kind === 'synced');
    const onFirst = first.store.session?.document.cards.get(card.id as TCardId);
    assert(onFirst !== undefined);

    expect(onFirst.title).toBe('Bank (main)');
    expect(allFields(onFirst).flatMap(fieldValues)).toEqual(['jane.doe']);
    expect(concurrentVersions(onFirst)).toEqual([]);
  });
});
