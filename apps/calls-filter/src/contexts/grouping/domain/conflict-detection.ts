import { MAX_NUMBER_DIGITS } from '../../masks/domain/number-mask';
import { canonicalNumberPattern } from '../../masks/domain/number-mask-canonical';
import type { TPattern } from '../../masks/domain/pattern';
import { literalPattern } from '../../masks/domain/pattern';
import { findIntersection } from '../../masks/domain/pattern-automaton';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { TNormalizedName } from '../../phone/domain/name-normalization';
import type { IConflict, IConflictCause } from './conflict';
import { conflictKey } from './conflict';
import type { ICustomGroup, TAssignableGroup } from './group';
import type { GroupBook } from './group-book';
import { customGroups, myContactsGroup } from './group-book';
import type { IMatchingEnvironment } from './matching-environment';
import type { IContactMember, INameMaskMember, TMember, TNameField } from './member';
import { matchMember } from './member-matching';
import { claims, membership } from './membership';
import { pickedContactAsCaller } from './picked-contact';
import { specialConflicts } from './special-conflicts';

/** What conflicts are checked against besides the masks themselves. */
export interface IConflictFacts {
  readonly environment: IMatchingEnvironment;
  /** Callers from the call log, and every number of the address book as a caller. */
  readonly knownCallers: readonly ICaller[];
}

/** A longest name worth an example: past it the overlap is real but unreadable. */
const MAX_NAME_EXAMPLE = 64;

interface INumberSide {
  readonly member: TMember;
  readonly patterns: readonly TPattern[];
  /** A picked contact is always a contact: «exclude my contacts» of the other side drops it. */
  readonly isContact: boolean;
}

function numberSides(
  group: ICustomGroup,
  environment: IMatchingEnvironment
): readonly INumberSide[] {
  return group.include.flatMap((member): INumberSide[] => {
    if (member.kind === 'number-mask') {
      const canonical = canonicalNumberPattern(member.mask, environment.home);
      return canonical.ok ? [{ member, patterns: [canonical.value], isContact: false }] : [];
    }
    if (member.kind === 'contact') {
      return [{ member, patterns: member.numbers.map(literalPattern), isContact: true }];
    }
    return [];
  });
}

function excludedNumberPatterns(
  members: readonly TMember[],
  environment: IMatchingEnvironment
): readonly TPattern[] {
  return members.flatMap(member => {
    if (member.kind === 'number-mask') {
      const canonical = canonicalNumberPattern(member.mask, environment.home);
      return canonical.ok ? [canonical.value] : [];
    }
    return member.kind === 'contact' ? member.numbers.map(literalPattern) : [];
  });
}

function fieldsOverlap(left: TNameField, right: TNameField): boolean {
  return left === right || left === 'any' || right === 'any';
}

function nameMembers(members: readonly TMember[]): readonly INameMaskMember[] {
  return members.filter((member): member is INameMaskMember => member.kind === 'name-mask');
}

function cause(group: TAssignableGroup, members: readonly TMember[]): IConflictCause {
  return { group: group.id, members };
}

function numberConflicts(
  left: ICustomGroup,
  right: ICustomGroup,
  environment: IMatchingEnvironment
): IConflict[] {
  const forbidden = [
    ...excludedNumberPatterns(left.exclude, environment),
    ...excludedNumberPatterns(right.exclude, environment),
  ];
  const conflicts: IConflict[] = [];
  for (const leftSide of numberSides(left, environment)) {
    for (const rightSide of numberSides(right, environment)) {
      const contactDropped =
        (leftSide.isContact && right.excludeMyContacts && rightSide.member.kind !== 'contact') ||
        (rightSide.isContact && left.excludeMyContacts && leftSide.member.kind !== 'contact');
      if (contactDropped) {
        continue;
      }
      const example = leftSide.patterns
        .flatMap(leftPattern =>
          rightSide.patterns.map(rightPattern =>
            findIntersection({
              required: [leftPattern, rightPattern],
              forbidden,
              alphabet: 'digits',
              maxLength: MAX_NUMBER_DIGITS,
            })
          )
        )
        .find(found => found !== null);
      if (example !== undefined && example !== null) {
        conflicts.push({
          groups: [left.id, right.id],
          example: { kind: 'number', digits: example as TE164Digits },
          causes: [cause(left, [leftSide.member]), cause(right, [rightSide.member])],
          knownCallers: [],
        });
      }
    }
  }
  return conflicts;
}

function nameConflicts(left: ICustomGroup, right: ICustomGroup): IConflict[] {
  const conflicts: IConflict[] = [];
  for (const leftMember of nameMembers(left.include)) {
    for (const rightMember of nameMembers(right.include)) {
      if (!fieldsOverlap(leftMember.field, rightMember.field)) {
        continue;
      }
      const forbidden = [...nameMembers(left.exclude), ...nameMembers(right.exclude)]
        .filter(
          member =>
            fieldsOverlap(member.field, leftMember.field) &&
            fieldsOverlap(member.field, rightMember.field)
        )
        .map(member => member.mask.pattern);
      const example = findIntersection({
        required: [leftMember.mask.pattern, rightMember.mask.pattern],
        forbidden,
        alphabet: 'text',
        maxLength: MAX_NAME_EXAMPLE,
      });
      if (example !== null) {
        conflicts.push({
          groups: [left.id, right.id],
          example: { kind: 'name', name: example as TNormalizedName },
          causes: [cause(left, [leftMember]), cause(right, [rightMember])],
          knownCallers: [],
        });
      }
    }
  }
  return conflicts;
}

function causesFor(
  groups: readonly TAssignableGroup[],
  caller: ICaller,
  environment: IMatchingEnvironment
): IConflictCause[] {
  return groups.map(group =>
    cause(
      group,
      group.kind === 'custom'
        ? group.include.filter(member => matchMember(member, caller, environment) !== null)
        : []
    )
  );
}

function factualConflicts(book: GroupBook, facts: IConflictFacts): IConflict[] {
  return facts.knownCallers.flatMap((caller): IConflict[] => {
    const found = membership(book, caller, facts.environment);
    return found.kind === 'conflict'
      ? [
          {
            groups: found.groups.map(group => group.id),
            example: { kind: 'caller', caller },
            causes: causesFor(found.groups, caller, facts.environment),
            knownCallers: [caller],
          },
        ]
      : [];
  });
}

function pickedContactConflicts(book: GroupBook, facts: IConflictFacts): IConflict[] {
  const myContacts = myContactsGroup(book);
  return customGroups(book).flatMap(group =>
    group.include
      .filter((member): member is IContactMember => member.kind === 'contact')
      .flatMap((member): IConflict[] => {
        const asCaller = pickedContactAsCaller(member);
        return claims(myContacts, asCaller, facts.environment)
          ? [
              {
                groups: [group.id, myContacts.id],
                example: { kind: 'caller', caller: asCaller },
                causes: [cause(group, [member]), cause(myContacts, [])],
                knownCallers: [],
              },
            ]
          : [];
      })
  );
}

/** Merges conflicts over the same groups into one card: the first example, every known caller. */
function merged(conflicts: readonly IConflict[]): readonly IConflict[] {
  const byGroups = new Map<string, IConflict>();
  for (const conflict of conflicts) {
    const key = conflictKey(conflict.groups);
    const existing = byGroups.get(key);
    byGroups.set(
      key,
      existing === undefined
        ? conflict
        : {
            ...existing,
            causes: existing.causes.map(existingCause => ({
              ...existingCause,
              members: uniqueById([
                ...existingCause.members,
                ...(conflict.causes.find(other => other.group === existingCause.group)?.members ??
                  []),
              ]),
            })),
            knownCallers: [...existing.knownCallers, ...conflict.knownCallers],
          }
    );
  }
  return [...byGroups.values()];
}

function uniqueById(members: readonly TMember[]): readonly TMember[] {
  return [...new Map(members.map(member => [member.id, member])).values()];
}

/**
 * Every place where two groups take the same caller. Masks are compared exactly through
 * their automata; what masks cannot say (names against numbers, special masks, «my
 * contacts») is checked against the callers already known.
 */
export function detectConflicts(book: GroupBook, facts: IConflictFacts): readonly IConflict[] {
  const custom = customGroups(book);
  const pairwise = custom.flatMap((left, index) =>
    custom
      .slice(index + 1)
      .flatMap(right => [
        ...numberConflicts(left, right, facts.environment),
        ...nameConflicts(left, right),
        ...specialConflicts(left, right),
      ])
  );
  return merged([
    ...pairwise,
    ...pickedContactConflicts(book, facts),
    ...factualConflicts(book, facts),
  ]);
}
