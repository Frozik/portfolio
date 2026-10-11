import { decodeDraft } from '../format/draft-codec';
import type { TCardDraft } from '../model/draft';
import type { ISealedRecordStore, TVaultKey } from '../persistence/ports';
import type { IRandom } from '../ports/random';
import type { ISealedJsonRecord } from './sealed-json-record';
import { createSealedJsonRecord } from './sealed-json-record';

/** One edit in progress per vault: a second one would only raise the question which to offer back. */
const DRAFT_RECORD = 'card-draft';

/**
 * The draft of the card being edited,
 * sealed under `K_draft` so the device store never holds it in the clear,
 * and offered back after the next unlock.
 */
export type IDraftRecord = ISealedJsonRecord<TCardDraft>;

export function createDraftRecord({
  store,
  vaultKey,
  dek,
  random,
}: {
  readonly store: ISealedRecordStore;
  readonly vaultKey: TVaultKey;
  readonly dek: CryptoKey;
  readonly random: IRandom;
}): IDraftRecord {
  return createSealedJsonRecord({
    store,
    vaultKey,
    recordKey: DRAFT_RECORD,
    dek,
    label: 'pwv/draft',
    random,
    decode: decodeDraft,
  });
}
