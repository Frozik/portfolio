import type { TFieldId } from '@frozik/vault/model/ids';
import { makeAutoObservable, observableRef } from 'mobx';

import type { ILockSignalSource } from '../../session/domain/ports/lock-signal-source';
import type { ISessionClock } from '../../session/domain/ports/session-clock';

/** A shown secret hides again after this long. */
export const REVEAL_FOR_MS = 30_000;

/** One value of a field: the only one of a single field, or one of a list by its place. */
function keyOf(fieldId: TFieldId, index: number): string {
  return `${fieldId}#${index}`;
}

/** Which secret values are shown, each on its own; each hides itself again, and all hide with the tab or the card. */
export class RevealModel {
  revealed: ReadonlySet<string> = new Set();

  private readonly timers = new Map<string, () => void>();
  private readonly stopWatchingPage: () => void;

  constructor(
    private readonly clock: ISessionClock,
    signals: ILockSignalSource
  ) {
    makeAutoObservable<RevealModel, 'timers' | 'stopWatchingPage' | 'clock'>(
      this,
      { revealed: observableRef, timers: false, stopWatchingPage: false, clock: false },
      { autoBind: true }
    );
    this.stopWatchingPage = signals.onConcealed(hidden => {
      if (hidden) {
        this.hideAll();
      }
    });
  }

  isRevealed(fieldId: TFieldId, index = 0): boolean {
    return this.revealed.has(keyOf(fieldId, index));
  }

  toggle(fieldId: TFieldId, index = 0): void {
    const key = keyOf(fieldId, index);
    if (this.revealed.has(key)) {
      this.hide(key);
      return;
    }
    this.revealed = new Set([...this.revealed, key]);
    this.timers.set(
      key,
      this.clock.after(REVEAL_FOR_MS, () => this.hide(key))
    );
  }

  /** The card was left, the tab hidden, or the session is ending. */
  hideAll(): void {
    this.timers.forEach(cancel => cancel());
    this.timers.clear();
    this.revealed = new Set();
  }

  dispose(): void {
    this.hideAll();
    this.stopWatchingPage();
  }

  private hide(key: string): void {
    this.timers.get(key)?.();
    this.timers.delete(key);
    this.revealed = new Set([...this.revealed].filter(revealed => revealed !== key));
  }
}
