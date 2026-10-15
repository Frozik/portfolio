import { assert } from '@frozik/utils/assert/assert';
import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import type { ICardState } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import type { TAssetId, TFieldId } from '@frozik/vault/model/ids';
import { DOCUMENT_TEMPLATE } from '@frozik/vault/model/templates/document';
import { when } from 'mobx';

import { aDevice } from '../../testing/fake-device';

async function editingADocument() {
  const store = aDevice().startStore();
  store.create('Home', 'correct horse battery staple');
  await when(() => store.session !== null);
  const session = store.session;
  assert(session !== null);
  const cardId = session.editing.startCreating(DOCUMENT_TEMPLATE.id, key => key);
  const draft = session.editing.draft;
  assert(draft !== null && cardId !== null);
  const scans = allFields(draft.card).find(field => field.spec.kind === 'file');
  assert(scans !== undefined);
  return { session, draft, cardId, scans };
}

function fileIdsOf(card: ICardState, fieldId: TFieldId): readonly TAssetId[] {
  const field = allFields(card).find(candidate => candidate.id === fieldId);
  return field === undefined ? [] : fileAssetIdsOf(field);
}

const scan = (size: number) => ({
  name: 'scan.png',
  type: 'image/png',
  bytes: new Uint8Array(size),
});

describe('attaching files', () => {
  it('puts a picked scan into the vault and the field, and keeps it with the saved card', async () => {
    const { session, draft, cardId, scans } = await editingADocument();

    expect(await draft.attachFiles(scans.id, [scan(2048)])).toEqual([]);
    const [assetId] = fileIdsOf(draft.card, scans.id);
    assert(assetId !== undefined);
    expect(session.document.assetBytes.get(assetId)?.byteLength).toBe(2048);
    draft.save();

    const saved = session.document.cards.get(cardId);
    assert(saved !== undefined);
    expect(fileIdsOf(saved, scans.id)).toEqual([assetId]);
  });
});
