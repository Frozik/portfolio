import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { TNormalizedName } from '../../phone/domain/name-normalization';
import type { TGroupId } from './group';
import type { TMember, TSpecialMask } from './member';

/** What two groups both take, shown to the user: a number, a name, or a real caller. */
type TConflictExample =
  | { readonly kind: 'number'; readonly digits: TE164Digits }
  | { readonly kind: 'name'; readonly name: TNormalizedName }
  | { readonly kind: 'special'; readonly special: TSpecialMask }
  | { readonly kind: 'caller'; readonly caller: ICaller };

/** The members of one group that take the example; empty for «my contacts», which takes every contact. */
export interface IConflictCause {
  readonly group: TGroupId;
  readonly members: readonly TMember[];
}

export interface IConflict {
  /** Two or more groups, in book order. */
  readonly groups: readonly TGroupId[];
  readonly example: TConflictExample;
  readonly causes: readonly IConflictCause[];
  /** Callers from the call log and the address book the conflict already touches. */
  readonly knownCallers: readonly ICaller[];
}

export function conflictKey(groups: readonly TGroupId[]): string {
  return [...groups].sort().join('+');
}
