import { createHistory } from '@frozik/utils/history/createHistory';
import { isNil } from 'lodash-es';
import { createAtom, makeAutoObservable } from 'mobx';

import type { SitePlan } from '../domain/model/site-plan';

/**
 * How long a burst of edits to one field collapses into a single undo step.
 * Typing "12.50" into a width is one change to the user, not five.
 */
const HISTORY_GROUP_WINDOW_MS = 1000;

/**
 * The undo stack and the announce-then-commit protocol around it. An edit is
 * announced first — the plan as it stands becomes the state the edit is undone
 * to — and reaches the stack only once the plan actually changes, so a click
 * that selects nothing and a gesture that puts everything back leave no step.
 * The stack itself is a plain closure; an atom reports every change to it, so
 * `canUndo` and `canRedo` are derivations rather than flags kept in sync.
 */
export class PlanHistory {
  private readonly stack = createHistory<SitePlan>();
  private readonly atom = createAtom('PlanHistory');
  /** The plan as it was before an announced edit, held until that edit lands. */
  private pendingPlan: SitePlan | undefined = undefined;
  private lastGroupKey: string | undefined = undefined;
  private lastAnnouncedAtMs = 0;
  /** True while one command is applying several edits — see `runBatched`. */
  private isBatching = false;

  constructor() {
    makeAutoObservable<
      PlanHistory,
      'stack' | 'atom' | 'pendingPlan' | 'lastGroupKey' | 'lastAnnouncedAtMs' | 'isBatching'
    >(
      this,
      {
        stack: false,
        atom: false,
        pendingPlan: false,
        lastGroupKey: false,
        lastAnnouncedAtMs: false,
        isBatching: false,
      },
      { autoBind: true }
    );
  }

  get canUndo(): boolean {
    this.atom.reportObserved();

    return this.stack.canUndo();
  }

  get canRedo(): boolean {
    this.atom.reportObserved();

    return this.stack.canRedo();
  }

  /**
   * Announces an edit. Callers that edit the plan once announce inside their
   * own action; a gesture or a typed number announces once, at the start, a
   * field passing its own `groupKey` so a burst of keystrokes stays one step.
   */
  announce(current: SitePlan, groupKey?: string): void {
    // Inside a batch the first announcement already captured the state before
    // the whole operation; the rest would each start a step of their own.
    if (this.isBatching) {
      return;
    }

    const nowMs = performance.now();
    const isGroupedRepeat =
      !isNil(groupKey) &&
      groupKey === this.lastGroupKey &&
      nowMs - this.lastAnnouncedAtMs < HISTORY_GROUP_WINDOW_MS;

    this.lastGroupKey = groupKey;
    this.lastAnnouncedAtMs = nowMs;

    if (!isGroupedRepeat) {
      this.pendingPlan = current;
    }
  }

  /** Turns the announced state into a step, now that the plan has moved off it. */
  commit(): void {
    const pendingPlan = this.pendingPlan;

    if (isNil(pendingPlan)) {
      return;
    }

    this.pendingPlan = undefined;
    this.stack.push(pendingPlan);
    this.atom.reportChanged();
  }

  /** A plan that arrives whole discards the state an announced edit was going to be undone to. */
  discardPending(): void {
    this.pendingPlan = undefined;
    this.lastGroupKey = undefined;
  }

  /** Arms a state to undo to after the fact — for a plan adopted from a file. */
  armPending(plan: SitePlan): void {
    this.pendingPlan = plan;
  }

  undo(current: SitePlan): SitePlan | undefined {
    const previous = this.stack.undo(current);

    this.atom.reportChanged();

    return previous;
  }

  redo(current: SitePlan): SitePlan | undefined {
    const next = this.stack.redo(current);

    this.atom.reportChanged();

    return next;
  }

  /** Runs a command whose several edits are one step of history. */
  runBatched(command: VoidFunction): void {
    this.isBatching = true;

    try {
      command();
    } finally {
      this.isBatching = false;
    }
  }
}
