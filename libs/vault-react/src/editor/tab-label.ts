import type { ICardTab } from '@frozik/vault/model/card';

import { vaultT } from '../texts/vault';

/** A tab's name in the tab bar: an untitled one is the card's main tab. */
export function tabLabelOf(tab: ICardTab): string {
  return tab.title === null || tab.title === '' ? vaultT.card.mainTab : tab.title;
}
