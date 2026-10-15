import type { TCardId } from '@frozik/vault/model/ids';
import type { TGroupSelection } from '@frozik/vault/model/smart-groups';

/** The list's selection: a built-in smart group, or a user group by its id. */
export type TVaultSection = TGroupSelection;

/** What an open vault shows; each renderer maps it to its own routes. */
export type TVaultPage =
  | { readonly kind: 'section'; readonly section: TVaultSection }
  | { readonly kind: 'card'; readonly section: TVaultSection; readonly cardId: TCardId }
  | { readonly kind: 'history'; readonly section: TVaultSection; readonly cardId: TCardId }
  | { readonly kind: 'settings' }
  | { readonly kind: 'audit' }
  | { readonly kind: 'unknown' };

/** What is shown before a vault is open: the start, or one of the ways to get a vault. */
export type TStartPage = 'start' | 'create' | 'open-from-cloud' | 'create-in-cloud';
