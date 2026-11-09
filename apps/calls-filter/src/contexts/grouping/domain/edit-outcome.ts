import type { IConflict } from './conflict';
import { conflictKey } from './conflict';
import type { IConflictFacts } from './conflict-detection';
import { detectConflicts } from './conflict-detection';
import type { GroupBook } from './group-book';
import type { TGroupBookEvent } from './group-book-events';

export type TEditRejection =
  | 'not-a-group-of-the-user'
  | 'strangers-take-nobody'
  | 'nothing-to-move'
  | 'not-a-contact'
  | 'unknown-group';

/**
 * The answer of every edit: applied, or not yet because it would make a conflict (the
 * proposed book waits for one of the sheet's resolutions), or refused.
 */
export type TEditOutcome =
  | {
      readonly kind: 'applied';
      readonly book: GroupBook;
      readonly events: readonly TGroupBookEvent[];
    }
  | {
      readonly kind: 'needs-resolution';
      readonly proposed: GroupBook;
      readonly events: readonly TGroupBookEvent[];
      readonly conflicts: readonly IConflict[];
    }
  | { readonly kind: 'rejected'; readonly reason: TEditRejection };

/** An edit from the user may not create a conflict; ones already there are not its business. */
export function guarded(
  before: GroupBook,
  after: GroupBook,
  events: readonly TGroupBookEvent[],
  facts: IConflictFacts
): TEditOutcome {
  const existing = new Set(
    detectConflicts(before, facts).map(conflict => conflictKey(conflict.groups))
  );
  const created = detectConflicts(after, facts).filter(
    conflict => !existing.has(conflictKey(conflict.groups))
  );
  return created.length === 0
    ? { kind: 'applied', book: after, events }
    : { kind: 'needs-resolution', proposed: after, events, conflicts: created };
}

export function rejected(reason: TEditRejection): TEditOutcome {
  return { kind: 'rejected', reason };
}
