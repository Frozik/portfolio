import type { IConflict } from './conflict';
import type { ICustomGroup } from './group';
import type { ISpecialMember, TMember } from './member';

function specialsOf(members: readonly TMember[]): readonly ISpecialMember[] {
  return members.filter((member): member is ISpecialMember => member.kind === 'special');
}

/**
 * The same special mask switched on in two groups: both take every such caller, so it is a
 * conflict the moment it is on, not only once such a call has come.
 */
export function specialConflicts(left: ICustomGroup, right: ICustomGroup): readonly IConflict[] {
  const excludedByRight = new Set(specialsOf(right.exclude).map(member => member.special));
  const excludedByLeft = new Set(specialsOf(left.exclude).map(member => member.special));
  return specialsOf(left.include).flatMap(leftMember => {
    const rightMember = specialsOf(right.include).find(
      member => member.special === leftMember.special
    );
    if (
      rightMember === undefined ||
      excludedByRight.has(leftMember.special) ||
      excludedByLeft.has(leftMember.special)
    ) {
      return [];
    }
    return [
      {
        groups: [left.id, right.id],
        example: { kind: 'special', special: leftMember.special },
        causes: [
          { group: left.id, members: [leftMember] },
          { group: right.id, members: [rightMember] },
        ],
        knownCallers: [],
      },
    ];
  });
}
