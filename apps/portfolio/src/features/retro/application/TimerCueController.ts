import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import { computeRemainingMs } from '../domain/timer';
import type { ITimerState } from '../domain/types';
import type { ISoundPlayer } from '../infrastructure/sound';

const MS_IN_SECOND = 1_000;
const EXPIRED_SECONDS = 0;
const WARNING_CUE_SECONDS = 10;
const COUNTDOWN_CUE_FROM_SECONDS = 5;
const COUNTDOWN_CUE_TO_SECONDS = 1;

/**
 * Second-accurate timer audio cues: a warning beep at 10 s, a tick on each of
 * the last five seconds and a triple beep plus `onExpired` at zero. Cues fire
 * on a downward whole-second crossing, so each sounds once per second even
 * though the room ticks twice a second.
 */
export class TimerCueController {
  private lastRemainingSec: number | undefined;

  constructor(
    private readonly soundPlayer: ISoundPlayer,
    private readonly onExpired: () => void
  ) {}

  handleTick(timer: ITimerState | undefined, nowMs: Milliseconds): void {
    if (isNil(timer) || isNil(timer.startedAt)) {
      this.lastRemainingSec = undefined;
      return;
    }

    const remainingMs = computeRemainingMs(timer, nowMs);
    const remainingSec = Math.max(0, Math.ceil(remainingMs / MS_IN_SECOND));
    const previousSec = this.lastRemainingSec;
    this.lastRemainingSec = remainingSec;

    if (isNil(previousSec) || previousSec <= remainingSec) {
      return;
    }
    if (remainingSec === EXPIRED_SECONDS) {
      this.soundPlayer.play('timerExpired');
      this.onExpired();
      return;
    }
    if (remainingSec === WARNING_CUE_SECONDS) {
      this.soundPlayer.play('timerWarning');
      return;
    }
    if (remainingSec >= COUNTDOWN_CUE_TO_SECONDS && remainingSec <= COUNTDOWN_CUE_FROM_SECONDS) {
      this.soundPlayer.play('timerCountdown');
    }
  }

  dispose(): void {
    this.lastRemainingSec = undefined;
    this.soundPlayer.dispose();
  }
}
