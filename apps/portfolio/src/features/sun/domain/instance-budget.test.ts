import type { InstanceBudget } from './instance-budget';
import { INITIAL_INSTANCE_BUDGET, instanceCountOf, reportFps } from './instance-budget';
import {
  INSTANCE_COUNT_LEVELS,
  LOW_FPS_REPORTS_TO_STEP_DOWN,
  LOW_FPS_THRESHOLD,
} from './sun-constants';

const SMOOTH_FPS = LOW_FPS_THRESHOLD + 30;
const CHOPPY_FPS = LOW_FPS_THRESHOLD - 10;

function reportTimes(budget: InstanceBudget, fps: number, times: number): InstanceBudget {
  let next = budget;
  for (let report = 0; report < times; report++) {
    next = reportFps(next, fps);
  }
  return next;
}

describe('instance budget', () => {
  it('starts with the richest sphere and keeps it while the frame rate holds', () => {
    const budget = reportTimes(INITIAL_INSTANCE_BUDGET, SMOOTH_FPS, 100);

    expect(instanceCountOf(budget)).toBe(INSTANCE_COUNT_LEVELS[0]);
  });

  it('steps down one level only after the frame rate stays low for the whole debounce', () => {
    const almost = reportTimes(
      INITIAL_INSTANCE_BUDGET,
      CHOPPY_FPS,
      LOW_FPS_REPORTS_TO_STEP_DOWN - 1
    );
    expect(instanceCountOf(almost)).toBe(INSTANCE_COUNT_LEVELS[0]);

    const stepped = reportFps(almost, CHOPPY_FPS);
    expect(instanceCountOf(stepped)).toBe(INSTANCE_COUNT_LEVELS[1]);
    expect(stepped.consecutiveLowFpsReports).toBe(0);
  });

  it('forgets the low streak as soon as one report is smooth again', () => {
    const almost = reportTimes(
      INITIAL_INSTANCE_BUDGET,
      CHOPPY_FPS,
      LOW_FPS_REPORTS_TO_STEP_DOWN - 1
    );
    const recovered = reportFps(almost, SMOOTH_FPS);

    expect(recovered).toEqual(INITIAL_INSTANCE_BUDGET);
  });

  it('never steps back up and stops at the cheapest level', () => {
    const cheapest = reportTimes(
      INITIAL_INSTANCE_BUDGET,
      CHOPPY_FPS,
      LOW_FPS_REPORTS_TO_STEP_DOWN * INSTANCE_COUNT_LEVELS.length * 2
    );
    expect(instanceCountOf(cheapest)).toBe(INSTANCE_COUNT_LEVELS[INSTANCE_COUNT_LEVELS.length - 1]);

    const later = reportTimes(cheapest, SMOOTH_FPS, 100);
    expect(instanceCountOf(later)).toBe(INSTANCE_COUNT_LEVELS[INSTANCE_COUNT_LEVELS.length - 1]);
  });
});
