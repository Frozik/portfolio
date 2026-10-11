import { countBy } from 'lodash-es';

import { latestStampOf } from '../model/document-stamp';
import type { TTemplateId } from '../model/ids';
import type { IVaultDocument } from '../model/vault-document';
import type { IImportContext } from './apply-import';
import { applyImport } from './apply-import';
import type { IImportBatch } from './imported-card';

export interface IImportPreview {
  readonly cards: number;
  readonly byTemplate: Readonly<Partial<Record<TTemplateId, number>>>;
  /** Entries the vault already has: what the duplicate choice is about. */
  readonly duplicates: number;
}

/**
 * What the import would do, found by doing it on a copy:
 * the preview and the import cannot disagree about what counts as a duplicate.
 */
export function previewImport(
  document: IVaultDocument,
  batch: IImportBatch,
  context: Omit<IImportContext, 'duplicates'>
): IImportPreview {
  const trial = applyImport(
    document,
    batch,
    { ...context, duplicates: 'skip' },
    latestStampOf(document)
  );
  return {
    cards: batch.cards.length,
    byTemplate: countBy(batch.cards, card => card.templateId),
    duplicates: trial.result.skipped,
  };
}
