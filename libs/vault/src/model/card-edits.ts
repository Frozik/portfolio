import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type {
  ICardField,
  ICardState,
  ICardTab,
  IVaultCard,
  TCardColor,
  TCardIconRef,
  TFieldSpec,
} from './card';
import { FIELD_KINDS } from './field-kinds/registry';
import type { IHlc } from './hlc';
import type { TCardId, TGroupId } from './ids';
import { newCardId, newFieldId, newTabId } from './ids';
import { cardState, commitCard } from './revision-edits';
import type { ICardTemplate, ITemplateField, ITemplateTab } from './templates/template';
import type { IVaultDocument } from './vault-document';

/** Resolves a template's translation keys in the language the card is created in. */
export type TTranslate = (key: string) => string;

function translatedSpec(field: ITemplateField, translate: TTranslate): TFieldSpec {
  const spec = field.spec ?? FIELD_KINDS[field.kind].defaultSpec;
  return spec.kind === 'select' ? { ...spec, options: spec.options.map(translate) } : spec;
}

function templateField(field: ITemplateField, translate: TTranslate, random: IRandom): ICardField {
  return {
    id: newFieldId(random),
    label: translate(field.labelKey),
    spec: translatedSpec(field, translate),
    value:
      field.cardinality === 'list'
        ? { cardinality: 'list', values: [] }
        : { cardinality: 'single', value: '' },
    sensitive: field.sensitive ?? FIELD_KINDS[field.kind].sensitiveByDefault,
    excludeFromAudit: false,
  };
}

/** The template's fields are copied once; the card is independent from then on. */
export function createCard(
  template: ICardTemplate,
  { translate, random }: { readonly translate: TTranslate; readonly random: IRandom },
  at: IHlc
): IVaultCard {
  const toTab = (tab: ITemplateTab): ICardTab => ({
    id: newTabId(random),
    title: isNil(tab.titleKey) ? null : translate(tab.titleKey),
    fields: tab.fields.map(field => templateField(field, translate, random)),
  });
  const [firstTab, ...otherTabs] = template.tabs;
  return {
    id: newCardId(random),
    title: '',
    templateId: template.id,
    tabs: [toTab(firstTab), ...otherTabs.map(toTab)],
    groupIds: [],
    favorite: false,
    color: null,
    icon: { kind: 'auto' },
    protected: false,
    archivedAt: null,
    trashedAt: null,
    createdAt: at,
    updatedAt: at,
    ancestors: [],
    history: [],
  };
}

export function putCard(document: IVaultDocument, card: IVaultCard): IVaultDocument {
  return document.cards.get(card.id) === card
    ? document
    : { ...document, cards: new Map(document.cards).set(card.id, card) };
}

/**
 * The one way a card of the document changes: the change
 * works on the card's state, the commit stamps it and keeps history. A change
 * that alters nothing leaves the document as it was.
 */
export function editCard(
  document: IVaultDocument,
  cardId: TCardId,
  at: IHlc,
  change: (card: ICardState) => ICardState
): IVaultDocument {
  const card = document.cards.get(cardId);
  if (isNil(card)) {
    return document;
  }
  return putCard(document, commitCard(card, change(cardState(card)), at));
}

export function renameCard(card: ICardState, title: string): ICardState {
  return card.title === title ? card : { ...card, title };
}

export function setFavorite(card: ICardState, favorite: boolean): ICardState {
  return card.favorite === favorite ? card : { ...card, favorite };
}

export function setColor(card: ICardState, color: TCardColor | null): ICardState {
  return card.color === color ? card : { ...card, color };
}

export function setIcon(card: ICardState, icon: TCardIconRef): ICardState {
  return { ...card, icon };
}

/** Interface protection, not cryptographic: the key is already in memory. */
export function setProtected(card: ICardState, isProtected: boolean): ICardState {
  return card.protected === isProtected ? card : { ...card, protected: isProtected };
}

export function archiveCard(card: ICardState, at: IHlc): ICardState {
  return isNil(card.archivedAt) ? { ...card, archivedAt: at } : card;
}

export function unarchiveCard(card: ICardState): ICardState {
  return isNil(card.archivedAt) ? card : { ...card, archivedAt: null };
}

/** Into the trash for 30 days; its links hide while it is there and come back with it. */
export function trashCard(card: ICardState, at: IHlc): ICardState {
  return isNil(card.trashedAt) ? { ...card, trashedAt: at } : card;
}

export function restoreCard(card: ICardState): ICardState {
  return isNil(card.trashedAt) ? card : { ...card, trashedAt: null };
}

export function addToGroup(card: ICardState, groupId: TGroupId): ICardState {
  return card.groupIds.includes(groupId)
    ? card
    : { ...card, groupIds: [...card.groupIds, groupId] };
}

export function removeFromGroup(card: ICardState, groupId: TGroupId): ICardState {
  return card.groupIds.includes(groupId)
    ? { ...card, groupIds: card.groupIds.filter(id => id !== groupId) }
    : card;
}

/** The same edit for each card of a multi-selection, under one stamp. */
export function editCards(
  document: IVaultDocument,
  cardIds: readonly TCardId[],
  at: IHlc,
  change: (card: ICardState) => ICardState
): IVaultDocument {
  return cardIds.reduce((current, cardId) => editCard(current, cardId, at, change), document);
}

/** A new card with fresh ids for itself, its tabs and fields, and no history. */
export function duplicateCard(
  card: IVaultCard,
  title: string,
  random: IRandom,
  at: IHlc
): IVaultCard {
  const copyTab = (tab: ICardTab): ICardTab => ({
    ...tab,
    id: newTabId(random),
    fields: tab.fields.map(field => ({ ...field, id: newFieldId(random) })),
  });
  const [firstTab, ...otherTabs] = card.tabs;
  return {
    ...card,
    id: newCardId(random),
    title,
    tabs: [copyTab(firstTab), ...otherTabs.map(copyTab)],
    archivedAt: null,
    trashedAt: null,
    createdAt: at,
    updatedAt: at,
    ancestors: [],
    history: [],
  };
}
