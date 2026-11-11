import type { ICardState, TCardColor } from '@frozik/vault/model/card';
import { duplicateCard, editCard, putCard } from '@frozik/vault/model/card-edits';
import type { TConcurrentResolution } from '@frozik/vault/model/card-versions';
import { resolveConcurrentVersions } from '@frozik/vault/model/card-versions';
import { createGroup, deleteGroup, updateGroup } from '@frozik/vault/model/group-edits';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { TCardId, TGroupId } from '@frozik/vault/model/ids';
import { linkCards, linkIdOf, unlinkCards } from '@frozik/vault/model/link-edits';
import { purgeCard } from '@frozik/vault/model/purge-card';
import { forgetRevision, restoreRevision } from '@frozik/vault/model/revision-edits';
import type { IUserGroup } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';

import type { TDocumentEdit } from './transact';

/** The card menu's small edits: no editor, straight into the document. */
export function changeCard(
  cardId: TCardId,
  change: (card: ICardState, at: IHlc) => ICardState
): TDocumentEdit<undefined> {
  return (document, at) => ({
    document: editCard(document, cardId, at, card => change(card, at)),
    result: undefined,
  });
}

/** A copy under a new title and new ids, outside archive and trash; the result is its id. */
export function duplicate(
  cardId: TCardId,
  title: string,
  random: IRandom
): TDocumentEdit<TCardId | null> {
  return (document, at) => {
    const card = document.cards.get(cardId);
    if (isNil(card)) {
      return { document, result: null };
    }
    const copy = duplicateCard(card, title, random, at);
    return { document: putCard(document, copy), result: copy.id };
  };
}

/** The versions made at the same time elsewhere are decided about: gone from every device after sync. */
export function resolveConcurrent(
  cardId: TCardId,
  resolution: TConcurrentResolution
): TDocumentEdit<undefined> {
  return (document, at) => {
    const card = document.cards.get(cardId);
    return {
      document: isNil(card)
        ? document
        : putCard(document, resolveConcurrentVersions(card, resolution, at)),
      result: undefined,
    };
  };
}

/** A version from the history comes back as a new edit; the current one goes to history. */
export function restore(cardId: TCardId, revisionAt: IHlc): TDocumentEdit<undefined> {
  return (document, at) => {
    const card = document.cards.get(cardId);
    return {
      document: isNil(card) ? document : putCard(document, restoreRevision(card, revisionAt, at)),
      result: undefined,
    };
  };
}

/** One version deleted from the card's history; the card as it is now stays untouched. */
export function forget(cardId: TCardId, revisionAt: IHlc): TDocumentEdit<undefined> {
  return document => {
    const card = document.cards.get(cardId);
    return {
      document: isNil(card) ? document : putCard(document, forgetRevision(card, revisionAt)),
      result: undefined,
    };
  };
}

/** "delete forever" from the trash: a tombstone, so other devices drop it too. */
export function purge(cardId: TCardId): TDocumentEdit<undefined> {
  return (document, at) => ({ document: purgeCard(document, cardId, at), result: undefined });
}

/** Two cards that belong together (online banking and its cards); undirected. */
export function link(first: TCardId, second: TCardId): TDocumentEdit<undefined> {
  return (document, at) => {
    const linked = linkCards(document, first, second, at);
    return { document: linked.ok ? linked.value : document, result: undefined };
  };
}

export function unlink(first: TCardId, second: TCardId): TDocumentEdit<undefined> {
  return (document, at) => ({
    document: unlinkCards(document, linkIdOf(first, second), at),
    result: undefined,
  });
}

export function newGroup(
  name: string,
  random: IRandom,
  color: TCardColor | null = null
): TDocumentEdit<TGroupId> {
  return (document, at) => {
    const created = createGroup(document, name, at, random);
    return {
      document: isNil(color)
        ? created.document
        : updateGroup(created.document, created.groupId, at, { color }),
      result: created.groupId,
    };
  };
}

export function changeGroup(
  groupId: TGroupId,
  change: Partial<Pick<IUserGroup, 'name' | 'color'>>
): TDocumentEdit<undefined> {
  return (document, at) => ({
    document: updateGroup(document, groupId, at, change),
    result: undefined,
  });
}

/** The group goes; its cards stay, in their other groups or in none. */
export function removeGroup(groupId: TGroupId): TDocumentEdit<undefined> {
  return (document, at) => ({ document: deleteGroup(document, groupId, at), result: undefined });
}
