import { collectAssets } from '@frozik/vault/model/asset-edits';
import type { TAssetId } from '@frozik/vault/model/ids';
import { expireTrash } from '@frozik/vault/model/trash';
import { reaction } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

import type { TDocumentEdit } from './transact';

/**
 * Once a day (and at unlock): cards 30 days in the trash go for
 * good, files nothing refers to are stamped or dropped, except those a draft
 * still holds. Returns the stop.
 */
export function startHousekeeping({
  today,
  now,
  heldFiles,
  transact,
}: {
  readonly today: () => Temporal.PlainDate;
  readonly now: () => number;
  readonly heldFiles: () => readonly TAssetId[];
  readonly transact: (edit: TDocumentEdit<void>) => unknown;
}): () => void {
  return reaction(
    today,
    () =>
      transact((document, at) => ({
        document: collectAssets(expireTrash(document, now(), at), now(), at, heldFiles()),
        result: undefined,
      })),
    { fireImmediately: true }
  );
}
