import { setProtected } from '@frozik/vault/model/card-edits';
import type { TCardId } from '@frozik/vault/model/ids';

import { changeCard } from './card-actions';
import type { TTransact } from './transact';

/**
 * Protecting a card is always allowed; taking the protection off needs the
 * master password again, exactly as reading the card's secrets does — else
 * anyone at an unlocked vault could undo it with one click.
 */
export function changeProtection(
  session: { readonly transact: TTransact; readonly protectedGate: { readonly isOpen: boolean } },
  cardId: TCardId,
  protect: boolean
): 'done' | 'password-needed' {
  if (!protect && !session.protectedGate.isOpen) {
    return 'password-needed';
  }
  session.transact(changeCard(cardId, card => setProtected(card, protect)));
  return 'done';
}
