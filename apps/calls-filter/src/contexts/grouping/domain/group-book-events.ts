import type { TGroupId } from './group';
import type { TMember } from './member';

/** What an edit changed, for the snackbar that says so and offers to undo it. */
export type TGroupBookEvent =
  | { readonly kind: 'group-created'; readonly group: TGroupId }
  | { readonly kind: 'group-deleted'; readonly group: TGroupId }
  | { readonly kind: 'group-changed'; readonly group: TGroupId }
  | { readonly kind: 'member-added'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'member-removed'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'excluded'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'exclusion-removed'; readonly group: TGroupId; readonly member: TMember }
  | { readonly kind: 'my-contacts-excluded'; readonly group: TGroupId };
