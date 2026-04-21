import type { Milliseconds } from '@frozik/utils';

import { DEFAULT_BRAINSTORM_DURATION_MS, TIMER_WARNING_THRESHOLD_MS } from './constants';
import {
  computeRemainingMs,
  createIdleTimer,
  ETimerStatus,
  extendTimer,
  getTimerStatus,
  isTimerInWarningZone,
  pauseTimer,
  resetTimer,
  startTimer,
} from './timer';
import type { ITimerState } from './types';

const MINUTE = 60_000 as Milliseconds;
const BASE_NOW = 1_700_000_000_000 as Milliseconds;

function ms(value: number): Milliseconds {
  return value as Milliseconds;
}

describe('createIdleTimer', () => {
  it('defaults to the brainstorm duration with nothing running', () => {
    const timer = createIdleTimer();

    expect(timer.durationMs).toBe(DEFAULT_BRAINSTORM_DURATION_MS);
    expect(timer.startedAt).toBeNull();
    expect(timer.pausedRemainingMs).toBeNull();
  });

  it('accepts a custom duration', () => {
    const timer = createIdleTimer(ms(123_000));

    expect(timer.durationMs).toBe(123_000);
  });
});

describe('computeRemainingMs', () => {
  it('returns the full duration when the timer is idle', () => {
    const timer = createIdleTimer(ms(10 * MINUTE));

    expect(computeRemainingMs(timer, BASE_NOW)).toBe(10 * MINUTE);
  });

  it('returns pausedRemainingMs when paused', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: null,
      pausedRemainingMs: ms(3 * MINUTE),
    };

    expect(computeRemainingMs(timer, BASE_NOW)).toBe(3 * MINUTE);
  });

  it('decreases linearly while running', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(computeRemainingMs(timer, (BASE_NOW + 4 * MINUTE) as Milliseconds)).toBe(6 * MINUTE);
  });

  it('clamps to 0 when running past duration', () => {
    const timer: ITimerState = {
      durationMs: ms(MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(computeRemainingMs(timer, (BASE_NOW + 10 * MINUTE) as Milliseconds)).toBe(0);
  });
});

describe('getTimerStatus', () => {
  it('returns Idle for a fresh timer', () => {
    expect(getTimerStatus(createIdleTimer(), BASE_NOW)).toBe(ETimerStatus.Idle);
  });

  it('returns Paused when paused', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: null,
      pausedRemainingMs: ms(2 * MINUTE),
    };

    expect(getTimerStatus(timer, BASE_NOW)).toBe(ETimerStatus.Paused);
  });

  it('returns Running while still ticking', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(getTimerStatus(timer, (BASE_NOW + 3 * MINUTE) as Milliseconds)).toBe(
      ETimerStatus.Running
    );
  });

  it('returns Expired once remaining hits zero', () => {
    const timer: ITimerState = {
      durationMs: ms(MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(getTimerStatus(timer, (BASE_NOW + 5 * MINUTE) as Milliseconds)).toBe(
      ETimerStatus.Expired
    );
  });
});

describe('isTimerInWarningZone', () => {
  it('is true once running timer has less than warning threshold left', () => {
    const timer: ITimerState = {
      durationMs: ms(2 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    const now = (BASE_NOW + MINUTE + MINUTE / 2) as Milliseconds;

    expect(isTimerInWarningZone(timer, now)).toBe(true);
  });

  it('is false when plenty of time remains', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(isTimerInWarningZone(timer, BASE_NOW)).toBe(false);
  });

  it('is false once expired', () => {
    const timer: ITimerState = {
      durationMs: ms(MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    expect(isTimerInWarningZone(timer, (BASE_NOW + 5 * MINUTE) as Milliseconds)).toBe(false);
  });

  it('is false when paused even if remaining is tiny', () => {
    const timer: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: null,
      pausedRemainingMs: ms(TIMER_WARNING_THRESHOLD_MS - 1000),
    };

    expect(isTimerInWarningZone(timer, BASE_NOW)).toBe(false);
  });
});

describe('startTimer', () => {
  it('starts an idle timer at the given wall-clock time', () => {
    const timer = createIdleTimer(ms(10 * MINUTE));
    const started = startTimer(timer, BASE_NOW);

    expect(started.startedAt).toBe(BASE_NOW);
    expect(started.pausedRemainingMs).toBeNull();
    expect(computeRemainingMs(started, BASE_NOW)).toBe(10 * MINUTE);
  });

  it('resumes a paused timer so that remaining matches pausedRemainingMs', () => {
    const paused: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: null,
      pausedRemainingMs: ms(3 * MINUTE),
    };

    const resumed = startTimer(paused, BASE_NOW);

    expect(computeRemainingMs(resumed, BASE_NOW)).toBe(3 * MINUTE);

    const laterNow = (BASE_NOW + MINUTE) as Milliseconds;
    expect(computeRemainingMs(resumed, laterNow)).toBe(2 * MINUTE);
  });
});

describe('pauseTimer', () => {
  it('pauses a running timer and captures remaining ms', () => {
    const running: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    const paused = pauseTimer(running, (BASE_NOW + 4 * MINUTE) as Milliseconds);

    expect(paused.startedAt).toBeNull();
    expect(paused.pausedRemainingMs).toBe(6 * MINUTE);
  });

  it('is a no-op when the timer is already idle', () => {
    const idle = createIdleTimer();
    expect(pauseTimer(idle, BASE_NOW)).toBe(idle);
  });

  it('pause then resume preserves remaining across wall-clock gap', () => {
    const running: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    const paused = pauseTimer(running, (BASE_NOW + 4 * MINUTE) as Milliseconds);
    // Hours later...
    const RESUME_DELAY_MS = 3_600_000 as Milliseconds;
    const resumed = startTimer(paused, (BASE_NOW + RESUME_DELAY_MS) as Milliseconds);

    expect(computeRemainingMs(resumed, (BASE_NOW + RESUME_DELAY_MS) as Milliseconds)).toBe(
      6 * MINUTE
    );
  });
});

describe('extendTimer', () => {
  it('adds time to a running timer', () => {
    const running: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: BASE_NOW,
      pausedRemainingMs: null,
    };

    const extended = extendTimer(running, (2 * MINUTE) as Milliseconds);

    expect(extended.durationMs).toBe(12 * MINUTE);
    expect(computeRemainingMs(extended, (BASE_NOW + 9 * MINUTE) as Milliseconds)).toBe(3 * MINUTE);
  });

  it('adds time to a paused timer without starting it', () => {
    const paused: ITimerState = {
      durationMs: ms(10 * MINUTE),
      startedAt: null,
      pausedRemainingMs: ms(3 * MINUTE),
    };

    const extended = extendTimer(paused, (2 * MINUTE) as Milliseconds);

    expect(extended.startedAt).toBeNull();
    expect(extended.pausedRemainingMs).toBe(5 * MINUTE);
    expect(extended.durationMs).toBe(12 * MINUTE);
  });
});

describe('resetTimer', () => {
  it('returns a brand-new idle timer with the given duration', () => {
    const timer = resetTimer(ms(5 * MINUTE));

    expect(timer.durationMs).toBe(5 * MINUTE);
    expect(timer.startedAt).toBeNull();
    expect(timer.pausedRemainingMs).toBeNull();
  });
});
