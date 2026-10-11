import { assert } from '@frozik/utils/assert/assert';
import { renameCard } from '@frozik/vault/model/card-edits';
import { INTERNET_ACCOUNT_TEMPLATE } from '@frozik/vault/model/templates/internet-account';
import { when } from 'mobx';

import { DRAFT_SAVE_DEBOUNCE_MS } from './CardDraftModel';
import { aDevice } from './fake-device.test-helper';
import { createFakePageSignals } from './fake-page-signals.test-helper';
import type { VaultFeatureStore } from './VaultFeatureStore';
import type { VaultSession } from './VaultSession';

const PASSWORD = 'correct horse battery staple';

async function unlocked(store: VaultFeatureStore): Promise<VaultSession> {
  await when(() => store.session !== null);
  assert(store.session !== null);
  return store.session;
}

async function settled(session: VaultSession): Promise<void> {
  await when(() => session.local.state.phase.kind === 'idle');
}

describe('editing a card', () => {
  it('changes the vault only on "Save", and then for good', async () => {
    const store = aDevice().startStore();
    store.create('Home', PASSWORD);
    const session = await unlocked(store);

    const cardId = session.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key);
    assert(cardId !== null);
    session.editing.draft?.change(card => renameCard(card, 'GitHub'));
    expect(session.document.cards.has(cardId)).toBe(false);

    expect(session.editing.draft?.save()).toBe(true);
    expect(session.document.cards.get(cardId)?.title).toBe('GitHub');
  });

  it('keeps an unsaved edit through a lock and offers it back after unlocking', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    const session = await unlocked(first);
    const vaultKey = session.vaultKey;
    session.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key);
    session.editing.draft?.change(card => renameCard(card, 'Half-typed'));

    first.lock('manual');
    await when(() => first.lifecycle.kind === 'locked');

    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock(PASSWORD);
    const next = await unlocked(second);
    await when(() => next.editing.offeredDraft !== null);

    next.editing.continueOffered();
    expect(next.editing.draft?.card.title).toBe('Half-typed');
  });

  it('shows a change made on another tab meanwhile, and asks before saving over it', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    const mine = await unlocked(first);
    mine.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key);
    mine.editing.draft?.change(card => renameCard(card, 'Bank'));
    mine.editing.draft?.save();
    await settled(mine);
    const [card] = mine.document.cards.values();
    assert(card !== undefined);

    const other = device.startStore(createFakePageSignals());
    other.choose(mine.vaultKey);
    other.unlock(PASSWORD);
    const theirs = await unlocked(other);

    mine.editing.startEditing(card.id);
    mine.editing.draft?.change(edited => renameCard(edited, 'Bank (mine)'));
    theirs.editing.startEditing(card.id);
    theirs.editing.draft?.change(edited => renameCard(edited, 'Bank (theirs)'));
    theirs.editing.draft?.save();
    await when(() => mine.editing.draft?.remote.kind === 'changed-elsewhere');

    expect(mine.editing.draft?.save()).toBe(false);
    expect(mine.editing.draft?.pendingConflict?.clashes).toContain('title');
    expect(mine.editing.draft?.save({ kind: 'keep-mine' })).toBe(true);
    expect(mine.document.cards.get(card.id)?.title).toBe('Bank (mine)');
  });

  it('seals the draft into the device store once typing pauses', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Home', PASSWORD);
    const session = await unlocked(store);
    session.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key);

    session.editing.draft?.change(card => renameCard(card, 'Typed'));
    device.time.advance(DRAFT_SAVE_DEBOUNCE_MS);

    expect(session.flushDraft()).toBeNull();
  });

  it('never lets a second edit overwrite a dirty one or the draft on offer', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', PASSWORD);
    const session = await unlocked(first);
    const vaultKey = session.vaultKey;
    session.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key);
    session.editing.draft?.change(card => renameCard(card, 'Left behind'));

    expect(session.editing.startCreating(INTERNET_ACCOUNT_TEMPLATE.id, key => key)).toBeNull();
    first.lock('manual');
    await when(() => first.lifecycle.kind === 'locked');

    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock(PASSWORD);
    const next = await unlocked(second);
    await when(() => next.editing.offeredDraft !== null);

    expect(next.editing.canStart).toBe(false);
    next.editing.discardOffered();
    expect(next.editing.canStart).toBe(true);
  });
});
