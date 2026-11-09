import type { ICaller } from '../../phone/domain/caller';
import type { TAssignableGroup, TGroupId } from './group';
import type { GroupBook } from './group-book';

/** The groups a call may move to: the user's own and, for a contact, «my contacts» — never where it already is. */
export function moveTargets(
  book: GroupBook,
  from: TGroupId,
  caller: ICaller
): readonly TAssignableGroup[] {
  return book.groups.filter(
    (group): group is TAssignableGroup =>
      group.id !== from &&
      (group.kind === 'custom' || (group.kind === 'my-contacts' && caller.contact !== null))
  );
}
