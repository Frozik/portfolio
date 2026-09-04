import { assertNever } from '@frozik/utils/assert/assertNever';
import { nowEpochMs } from '@frozik/utils/date/now';
import type { Milliseconds } from '@frozik/utils/date/types';
import { clamp, isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import { MAX_TIMER_DURATION_MS, MIN_TIMER_DURATION_MS } from '../domain/constants';
import {
  computeRemainingMs,
  extendTimer,
  getTimerStatus,
  isTimerInWarningZone,
  pauseTimer,
  resetTimer,
  startTimer,
} from '../domain/timer';
import type { ITimerState } from '../domain/types';
import type { ISoundPlayer } from '../infrastructure/sound';
import { TimerCueController } from './TimerCueController';

export type TimerSeverity = 'idle' | 'running' | 'warning' | 'expired';

export interface ITimerModelDeps {
  readonly readTimer: () => ITimerState | undefined;
  readonly writeTimer: (timer: ITimerState) => void;
  readonly isFacilitator: () => boolean;
  readonly soundPlayer: ISoundPlayer;
  readonly readNow?: () => Milliseconds;
}

/**
 * The room clock as the UI sees it: a ticking "now", the severity of the
 * remaining time, the facilitator's controls and the audio cues. The timer
 * state itself lives in the shared doc; this model only reads and writes it.
 */
export class TimerModel {
  tickNow: Milliseconds;

  private readonly deps: ITimerModelDeps;
  private readonly readNow: () => Milliseconds;
  private readonly cues: TimerCueController;

  constructor(deps: ITimerModelDeps) {
    this.deps = deps;
    this.readNow = deps.readNow ?? ((): Milliseconds => nowEpochMs() as Milliseconds);
    this.tickNow = this.readNow();
    this.cues = new TimerCueController(deps.soundPlayer, () => {
      this.handleExpired();
    });
    makeAutoObservable<TimerModel, 'deps' | 'cues' | 'readNow'>(
      this,
      { tickNow: observableRef, deps: false, cues: false, readNow: false },
      { autoBind: true }
    );
  }

  tick(): void {
    this.tickNow = this.readNow();
    this.cues.handleTick(this.deps.readTimer(), this.tickNow);
  }

  get severity(): TimerSeverity {
    const timer = this.deps.readTimer();
    if (isNil(timer)) {
      return 'idle';
    }
    const status = getTimerStatus(timer, this.tickNow);
    switch (status) {
      case 'idle':
        return 'idle';
      case 'paused':
        // Auto-paused at 00:00 stays visually expired; any other pause is neutral.
        return computeRemainingMs(timer, this.tickNow) <= 0 ? 'expired' : 'idle';
      case 'expired':
        return 'expired';
      case 'running':
        return isTimerInWarningZone(timer, this.tickNow) ? 'warning' : 'running';
      default:
        return assertNever(status);
    }
  }

  get remainingMs(): Milliseconds {
    const timer = this.deps.readTimer();
    return isNil(timer) ? (0 as Milliseconds) : computeRemainingMs(timer, this.tickNow);
  }

  start(): void {
    this.updateAsFacilitator(timer => startTimer(timer, this.readNow()));
  }

  pause(): void {
    this.updateAsFacilitator(timer => pauseTimer(timer, this.readNow()));
  }

  /** The remaining time is clamped to the allowed range, so a ±30 s step lands on the bound. */
  addMilliseconds(extraMs: Milliseconds): void {
    this.updateAsFacilitator(timer => {
      const currentRemainingMs = computeRemainingMs(timer, this.readNow());
      const nextRemainingMs = clamp(
        currentRemainingMs + extraMs,
        MIN_TIMER_DURATION_MS,
        MAX_TIMER_DURATION_MS
      );
      const effectiveDelta = (nextRemainingMs - currentRemainingMs) as Milliseconds;
      return effectiveDelta === 0 ? undefined : extendTimer(timer, effectiveDelta);
    });
  }

  reset(durationMs: Milliseconds): void {
    if (this.deps.isFacilitator()) {
      this.deps.writeTimer(resetTimer(durationMs));
    }
  }

  dispose(): void {
    this.cues.dispose();
  }

  private updateAsFacilitator(update: (timer: ITimerState) => ITimerState | undefined): void {
    const timer = this.deps.readTimer();
    if (!this.deps.isFacilitator() || isNil(timer)) {
      return;
    }
    const next = update(timer);
    if (!isNil(next)) {
      this.deps.writeTimer(next);
    }
  }

  /** Only the facilitator writes the pause; the doc update stops every peer's clock at 00:00. */
  private handleExpired(): void {
    this.pause();
  }
}
