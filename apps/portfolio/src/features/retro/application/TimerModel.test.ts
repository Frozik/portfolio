import type { Milliseconds } from '@frozik/utils/date/types';

import { MIN_TIMER_DURATION_MS, TIMER_WARNING_THRESHOLD_MS } from '../domain/constants';
import { createIdleTimer } from '../domain/timer';
import type { ITimerState } from '../domain/types';
import type { RetroSoundCue } from '../infrastructure/sound';
import { TimerModel } from './TimerModel';

const START_MS = 1_700_000_000_000 as Milliseconds;
const DURATION_MS = 120_000 as Milliseconds;
const SECOND_MS = 1_000;

interface IHarness {
  readonly model: TimerModel;
  readonly played: RetroSoundCue[];
  advance(ms: number): void;
  readonly writes: ITimerState[];
}

function createHarness(isFacilitator: boolean): IHarness {
  let timer: ITimerState = createIdleTimer(DURATION_MS);
  let now = START_MS;
  const played: RetroSoundCue[] = [];
  const writes: ITimerState[] = [];
  const model = new TimerModel({
    readTimer: () => timer,
    writeTimer: next => {
      timer = next;
      writes.push(next);
    },
    isFacilitator: () => isFacilitator,
    soundPlayer: { play: cue => played.push(cue), dispose(): void {} },
    readNow: () => now,
  });
  return {
    model,
    played,
    writes,
    advance(ms) {
      now = (now + ms) as Milliseconds;
      model.tick();
    },
  };
}

describe('TimerModel', () => {
  it('is idle until started, then runs, warns near the end and expires at zero', () => {
    const harness = createHarness(true);
    expect(harness.model.severity).toBe('idle');

    harness.model.start();
    harness.advance(0);
    expect(harness.model.severity).toBe('running');
    expect(harness.model.remainingMs).toBe(DURATION_MS);

    harness.advance(DURATION_MS - TIMER_WARNING_THRESHOLD_MS);
    expect(harness.model.severity).toBe('warning');

    harness.advance(TIMER_WARNING_THRESHOLD_MS);
    expect(harness.model.severity).toBe('expired');
    expect(harness.model.remainingMs).toBe(0);
  });

  it('cues the last seconds once each and auto-pauses at zero for the facilitator', () => {
    const harness = createHarness(true);
    harness.model.start();
    harness.advance(DURATION_MS - 11 * SECOND_MS);

    for (let step = 0; step < 22; step++) {
      harness.advance(SECOND_MS / 2);
    }

    expect(harness.played).toEqual([
      'timerWarning',
      'timerCountdown',
      'timerCountdown',
      'timerCountdown',
      'timerCountdown',
      'timerCountdown',
      'timerExpired',
    ]);
    expect(harness.writes.at(-1)).toMatchObject({ startedAt: undefined, pausedRemainingMs: 0 });
  });

  it('ignores control commands from a non-facilitator', () => {
    const harness = createHarness(false);

    harness.model.start();
    harness.model.addMilliseconds(30_000 as Milliseconds);
    harness.model.reset(DURATION_MS);

    expect(harness.writes).toEqual([]);
  });

  it('clamps an extension so the remaining time lands on the allowed bound', () => {
    const harness = createHarness(true);
    harness.model.start();
    harness.advance(0);

    harness.model.addMilliseconds(-(DURATION_MS * 2) as Milliseconds);
    harness.advance(0);

    expect(harness.model.remainingMs).toBe(MIN_TIMER_DURATION_MS);
  });
});
