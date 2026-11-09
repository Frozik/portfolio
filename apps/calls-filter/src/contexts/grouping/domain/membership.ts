import { assertNever } from '@frozik/utils/assert/assertNever';

import type { ICaller } from '../../phone/domain/caller';
import type { TAssignableGroup, TGroup } from './group';
import type { GroupBook } from './group-book';
import { strangersGroup } from './group-book';
import type { IMatchingEnvironment } from './matching-environment';
import { matchesAny, matchMember } from './member-matching';

export type TMembership =
  | { readonly kind: 'one'; readonly group: TGroup }
  | { readonly kind: 'conflict'; readonly groups: readonly TAssignableGroup[] };

export function claims(group: TGroup, caller: ICaller, environment: IMatchingEnvironment): boolean {
  switch (group.kind) {
    case 'custom': {
      if (matchesAny(group.exclude, caller, environment)) {
        return false;
      }
      const kinds = group.include.map(member => matchMember(member, caller, environment));
      if (kinds.includes('explicit')) {
        return true;
      }
      const isCutAsContact = group.excludeMyContacts && caller.contact !== null;
      return kinds.includes('pattern') && !isCutAsContact;
    }
    case 'my-contacts':
      return caller.contact !== null && !matchesAny(group.exclude, caller, environment);
    case 'strangers':
      return false;
    default:
      return assertNever(group);
  }
}

/** The group of a caller: exactly one, or a conflict the user has to resolve. */
export function membership(
  book: GroupBook,
  caller: ICaller,
  environment: IMatchingEnvironment
): TMembership {
  const claimants = book.groups.filter(
    (group): group is TAssignableGroup =>
      group.kind !== 'strangers' && claims(group, caller, environment)
  );
  const [only, ...others] = claimants;
  if (only === undefined) {
    return { kind: 'one', group: strangersGroup(book) };
  }
  return others.length === 0
    ? { kind: 'one', group: only }
    : { kind: 'conflict', groups: claimants };
}
