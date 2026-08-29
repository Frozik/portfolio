import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import { computeRemainingMs } from '../domain/timer';
import type { ITimerState } from '../domain/types';
import type { ISoundPlayer } from '../infrastructure/sound';
import { ERetroSoundCue } from '../infrastructure/sound';

const MS_IN_SECOND = 1_000;
const EXPIRED_SECONDS = 0;
const WARNING_CUE_SECONDS = 10;
const COUNTDOWN_CUE_FROM_SECONDS = 5;
const COUNTDOWN_CUE_TO_SECONDS = 1;

/**
 * Second-accurate timer audio cues:
 *   10s left  → single warning beep
 *   5..1s left → short countdown tick on each crossed second
 *   0s left   → triple expired beep, plus an `onExpired` notification
 *
 * Detection is based on crossing a whole-second boundary downwards, so each
 * sound fires exactly once even though the room ticks twice per second.
 */
export class TimerCueController {
  /**
   * Last observed "whole seconds remaining" value. Used to detect second
   * boundaries and fire countdown cues exactly once per crossed second.
   */
  private lastRemainingSec: number | null = null;

  constructor(
    private readonly soundPlayer: ISoundPlayer,
    private readonly onExpired: () => void
  ) {}

  handleTick(timer: ITimerState | undefined, nowMs: Milliseconds): void {
    if (isNil(timer) || isNil(timer.startedAt)) {
      this.lastRemainingSec = null;
      return;
    }

    const remainingMs = computeRemainingMs(timer, nowMs);
    const remainingSec = Math.max(0, Math.ceil(remainingMs / MS_IN_SECOND));
    const previousSec = this.lastRemainingSec;
    this.lastRemainingSec = remainingSec;

    if (previousSec === null || previousSec <= remainingSec) {
      return;
    }

    if (remainingSec === EXPIRED_SECONDS) {
      this.soundPlayer.play(ERetroSoundCue.TimerExpired);
      this.onExpired();
      return;
    }
    if (remainingSec === WARNING_CUE_SECONDS) {
      this.soundPlayer.play(ERetroSoundCue.TimerWarning);
      return;
    }
    if (remainingSec >= COUNTDOWN_CUE_TO_SECONDS && remainingSec <= COUNTDOWN_CUE_FROM_SECONDS) {
      this.soundPlayer.play(ERetroSoundCue.TimerCountdown);
    }
  }

  unlock(): void {
    this.soundPlayer.unlock();
  }

  dispose(): void {
    this.lastRemainingSec = null;
    this.soundPlayer.dispose();
  }
}
