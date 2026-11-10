import { assertNever } from '@frozik/utils/assert/assertNever';
import { action, computed, makeObservable, observableRef } from 'mobx';

import type { IClock } from '../../policy/domain/ports/clock';
import type { IConflict } from '../domain/conflict';
import type { IConflictFacts } from '../domain/conflict-detection';
import { detectConflicts } from '../domain/conflict-detection';
import type { IResolution } from '../domain/conflict-resolutions';
import { resolutionsFor } from '../domain/conflict-resolutions';
import type { TEditOutcome, TEditRejection } from '../domain/edit-outcome';
import type { GroupBook } from '../domain/group-book';
import type { TGroupBookEvent } from '../domain/group-book-events';
import { applyChanges } from '../domain/group-changes';
import type { TMemberId } from '../domain/member';
import type { TNewId } from '../domain/ports/id-source';

/** An edit waiting on the conflict sheet: the book it would make and the answers on offer. */
export interface IPendingEdit {
  readonly proposed: GroupBook;
  readonly events: readonly TGroupBookEvent[];
  readonly conflict: IConflict;
  readonly resolutions: readonly IResolution[];
}

export type TEditResult = 'applied' | 'needs-resolution' | { readonly rejected: TEditRejection };

export interface IEditContext {
  readonly now: ReturnType<IClock['now']>;
  readonly newMemberId: () => TMemberId;
  readonly facts: IConflictFacts;
}

/** A change the snackbar reports, with an id so the same message shown twice stays two messages. */
export interface IReportedChange {
  readonly id: number;
  readonly events: readonly TGroupBookEvent[];
}

const UNDO_DEPTH = 20;

/**
 * The one owner of the group book: every edit goes through `run`, which keeps the history
 * for «Undo» and stops at the conflict sheet when an edit would put a caller in two groups.
 */
export class GroupBookStore {
  book: GroupBook;
  pending: IPendingEdit | null = null;
  lastChange: IReportedChange | null = null;
  private history: readonly GroupBook[] = [];
  private changeCounter = 0;

  constructor(
    initial: GroupBook,
    private readonly clock: IClock,
    private readonly newId: TNewId,
    private readonly facts: () => IConflictFacts
  ) {
    this.book = initial;
    makeObservable<GroupBookStore, 'history' | 'commit'>(this, {
      book: observableRef,
      pending: observableRef,
      lastChange: observableRef,
      history: observableRef,
      conflicts: computed,
      canUndo: computed,
      run: action,
      choose: action,
      cancelPending: action,
      keepPending: action,
      undo: action,
      resolve: action,
      replace: action,
      commit: action,
    });
  }

  get conflicts(): readonly IConflict[] {
    return detectConflicts(this.book, this.facts());
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  context(): IEditContext {
    return {
      now: this.clock.now(),
      newMemberId: () => this.newId() as TMemberId,
      facts: this.facts(),
    };
  }

  run(edit: (book: GroupBook, context: IEditContext) => TEditOutcome): TEditResult {
    const context = this.context();
    const outcome = edit(this.book, context);
    switch (outcome.kind) {
      case 'applied':
        this.commit(outcome.book, outcome.events);
        return 'applied';
      case 'needs-resolution':
        this.offer(outcome.proposed, outcome.events, outcome.conflicts, context);
        return 'needs-resolution';
      case 'rejected':
        return { rejected: outcome.reason };
      default:
        return assertNever(outcome);
    }
  }

  /** The user's answer on the sheet: the proposed book with the resolution's changes, or the next conflict. */
  choose(resolution: IResolution): void {
    const { pending } = this;
    if (pending === null) {
      return;
    }
    const context = this.context();
    const resolved = applyChanges(pending.proposed, resolution.changes, context.now);
    const events = [...pending.events, ...resolved.events];
    const before = new Set(
      detectConflicts(this.book, context.facts).map(conflict => conflict.groups.join('+'))
    );
    const remaining = detectConflicts(resolved.book, context.facts).filter(
      conflict => !before.has(conflict.groups.join('+'))
    );
    if (remaining.length > 0) {
      this.offer(resolved.book, events, remaining, context);
      return;
    }
    this.pending = null;
    this.commit(resolved.book, events);
  }

  cancelPending(): void {
    this.pending = null;
  }

  /** The edit as proposed, the conflict it makes left for the screening to settle. */
  keepPending(): void {
    const { pending } = this;
    if (pending === null) {
      return;
    }
    this.pending = null;
    this.commit(pending.proposed, pending.events);
  }

  /** An answer to a conflict already in the book, from the conflicts screen. */
  resolve(resolution: IResolution): void {
    const changed = applyChanges(this.book, resolution.changes, this.clock.now());
    this.commit(changed.book, changed.events);
  }

  undo(): void {
    const previous = this.history.at(-1);
    if (previous === undefined) {
      return;
    }
    this.history = this.history.slice(0, -1);
    this.book = previous;
    this.lastChange = null;
  }

  /** A book that came from elsewhere (a merge, an import): no undo across it. */
  replace(book: GroupBook): void {
    this.book = book;
    this.history = [];
  }

  resolutionsOf(conflict: IConflict): readonly IResolution[] {
    const context = this.context();
    return resolutionsFor(this.book, conflict, {
      newMemberId: context.newMemberId,
      now: context.now,
    });
  }

  private offer(
    proposed: GroupBook,
    events: readonly TGroupBookEvent[],
    conflicts: readonly IConflict[],
    context: IEditContext
  ): void {
    const [conflict] = conflicts;
    if (conflict === undefined) {
      return;
    }
    this.pending = {
      proposed,
      events,
      conflict,
      resolutions: resolutionsFor(proposed, conflict, {
        newMemberId: context.newMemberId,
        now: context.now,
      }),
    };
  }

  private commit(book: GroupBook, events: readonly TGroupBookEvent[]): void {
    this.history = [...this.history, this.book].slice(-UNDO_DEPTH);
    this.book = book;
    this.changeCounter += 1;
    this.lastChange = { id: this.changeCounter, events };
  }
}
