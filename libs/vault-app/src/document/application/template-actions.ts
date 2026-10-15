import type { TCardId, TTemplateId } from '@frozik/vault/model/ids';
import { cardState } from '@frozik/vault/model/revision-edits';
import { deleteTemplate, renameTemplate, saveAsTemplate } from '@frozik/vault/model/template-edits';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';

import type { TDocumentEdit } from './transact';

/** The card as it is now becomes a template under the given name. */
export function saveCardAsTemplate(
  cardId: TCardId,
  name: string,
  random: IRandom
): TDocumentEdit<TTemplateId | null> {
  return (document, at) => {
    const card = document.cards.get(cardId);
    if (isNil(card)) {
      return { document, result: null };
    }
    const saved = saveAsTemplate(document, cardState(card), name, at, random);
    return { document: saved.document, result: saved.templateId };
  };
}

export function renameUserTemplate(id: TTemplateId, name: string): TDocumentEdit<undefined> {
  return (document, at) => ({
    document: renameTemplate(document, id, name, at),
    result: undefined,
  });
}

export function deleteUserTemplate(id: TTemplateId): TDocumentEdit<undefined> {
  return (document, at) => ({ document: deleteTemplate(document, id, at), result: undefined });
}
