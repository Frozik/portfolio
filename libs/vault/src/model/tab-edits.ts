import { replaceById } from '@frozik/utils/collections/edit-by-id';
import { isNonEmpty } from '@frozik/utils/collections/non-empty';
import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { ICardState, ICardTab } from './card';
import type { TTabId } from './ids';
import { newTabId } from './ids';

/** One tab stays untitled: a card back to a single tab shows no tab bar. */
function withTabs(card: ICardState, tabs: readonly ICardTab[]): ICardState {
  if (!isNonEmpty(tabs)) {
    return card;
  }
  const [only, ...rest] = tabs;
  return rest.length === 0 ? { ...card, tabs: [{ ...only, title: null }] } : { ...card, tabs };
}

export function addTab(
  card: ICardState,
  title: string,
  random: IRandom
): { readonly card: ICardState; readonly tabId: TTabId } {
  const tab: ICardTab = { id: newTabId(random), title, fields: [] };
  return { card: { ...card, tabs: [...card.tabs, tab] }, tabId: tab.id };
}

export function renameTab(card: ICardState, tabId: TTabId, title: string | null): ICardState {
  return card.tabs.length === 1
    ? card
    : withTabs(
        card,
        replaceById(card.tabs, tabId, tab => ({ ...tab, title }))
      );
}

export function moveTab(card: ICardState, tabId: TTabId, index: number): ICardState {
  const tab = card.tabs.find(candidate => candidate.id === tabId);
  if (isNil(tab)) {
    return card;
  }
  const rest = card.tabs.filter(candidate => candidate.id !== tabId);
  return withTabs(card, [...rest.slice(0, index), tab, ...rest.slice(index)]);
}

export type TRemovedTabFields =
  | { readonly kind: 'move-to'; readonly tabId: TTabId }
  | { readonly kind: 'delete' };

/** The last tab cannot go; its fields either move to another tab or go with it. */
export function removeTab(card: ICardState, tabId: TTabId, fields: TRemovedTabFields): ICardState {
  const removed = card.tabs.find(tab => tab.id === tabId);
  if (isNil(removed) || card.tabs.length === 1) {
    return card;
  }
  const rest = card.tabs.filter(tab => tab.id !== tabId);
  if (fields.kind === 'delete' || fields.tabId === tabId) {
    return withTabs(card, rest);
  }
  return withTabs(
    card,
    replaceById(rest, fields.tabId, tab => ({ ...tab, fields: [...tab.fields, ...removed.fields] }))
  );
}
