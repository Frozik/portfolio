import type { Temporal } from 'temporal-polyfill';

import type { ICaller } from '../../phone/domain/caller';
import type { IConflict } from './conflict';
import { contactMemberOf, exactNetworkNameMember, exactNumberMember } from './exact-members';
import type { TGroupId } from './group';
import type { GroupBook } from './group-book';
import { findGroup } from './group-book';
import type { TGroupChange } from './group-changes';
import type { TMember, TMemberId } from './member';

/**
 * A ready answer to a conflict, one tap in the sheet: which group keeps the callers and what
 * that writes into the others.
 */
export interface IResolution {
  readonly kind: 'keep-in' | 'keep-known-callers-in';
  readonly winner: TGroupId;
  readonly changes: readonly TGroupChange[];
}

export interface IResolutionContext {
  readonly newMemberId: () => TMemberId;
  readonly now: Temporal.Instant;
}

function copyAsExclusion(member: TMember, winner: TGroupId, context: IResolutionContext): TMember {
  return { ...member, id: context.newMemberId(), updatedAt: context.now, excludedFor: winner };
}

function exclusionOf(
  caller: ICaller,
  winner: TGroupId,
  context: IResolutionContext
): TMember | null {
  const stamp = { id: context.newMemberId(), now: context.now, excludedFor: winner };
  if (caller.contact !== null) {
    return contactMemberOf(caller, stamp);
  }
  if (caller.number !== null) {
    return exactNumberMember(caller.number, '', stamp);
  }
  return caller.networkName === null ? null : exactNetworkNameMember(caller.networkName, stamp);
}

function keepIn(
  book: GroupBook,
  conflict: IConflict,
  winner: TGroupId,
  context: IResolutionContext
): IResolution {
  const winnerGroup = findGroup(book, winner);
  const winnerMembers = conflict.causes.find(cause => cause.group === winner)?.members ?? [];
  const changes = conflict.groups
    .filter(group => group !== winner)
    .flatMap((loser): TGroupChange[] => {
      const loserGroup = findGroup(book, loser);
      if (winnerGroup?.kind === 'my-contacts' && loserGroup?.kind === 'custom') {
        const pickedContacts = (
          conflict.causes.find(cause => cause.group === loser)?.members ?? []
        ).filter(member => member.kind === 'contact');
        return pickedContacts.length > 0
          ? pickedContacts.map(member => ({
              kind: 'remove-include',
              group: loser,
              member: member.id,
            }))
          : [{ kind: 'exclude-my-contacts', group: loser }];
      }
      const loserMembers = conflict.causes.find(cause => cause.group === loser)?.members ?? [];
      return winnerMembers.flatMap((member): TGroupChange[] => {
        const exclusion: TGroupChange = {
          kind: 'add-exclude',
          group: loser,
          member: copyAsExclusion(member, winner, context),
        };
        const sameSpecial =
          member.kind === 'special'
            ? loserMembers.find(
                other => other.kind === 'special' && other.special === member.special
              )
            : undefined;
        return sameSpecial === undefined
          ? [exclusion]
          : [{ kind: 'remove-include', group: loser, member: sameSpecial.id }, exclusion];
      });
    });
  return { kind: 'keep-in', winner, changes };
}

function keepKnownCallersIn(
  conflict: IConflict,
  winner: TGroupId,
  context: IResolutionContext
): IResolution {
  const changes = conflict.groups
    .filter(group => group !== winner)
    .flatMap(loser =>
      conflict.knownCallers.flatMap((caller): TGroupChange[] => {
        const member = exclusionOf(caller, winner, context);
        return member === null ? [] : [{ kind: 'add-exclude', group: loser, member }];
      })
    );
  return { kind: 'keep-known-callers-in', winner, changes };
}

/** Every answer the sheet offers: «keep in A», «keep in B», and the same for known callers only. */
export function resolutionsFor(
  book: GroupBook,
  conflict: IConflict,
  context: IResolutionContext
): readonly IResolution[] {
  const whole = conflict.groups.map(winner => keepIn(book, conflict, winner, context));
  const known =
    conflict.knownCallers.length === 0
      ? []
      : conflict.groups.map(winner => keepKnownCallersIn(conflict, winner, context));
  return [...whole, ...known];
}
