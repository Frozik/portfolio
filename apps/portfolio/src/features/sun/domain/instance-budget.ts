import {
  INSTANCE_COUNT_LEVELS,
  LOW_FPS_REPORTS_TO_STEP_DOWN,
  LOW_FPS_THRESHOLD,
} from './sun-constants';

/**
 * Which entry of `INSTANCE_COUNT_LEVELS` is active and how long the frame
 * rate has been below the threshold at it. The budget only ever steps down:
 * stepping back up would raise the load, drop the FPS and step down again,
 * so a device that proved too slow once keeps the cheaper sphere.
 */
export interface InstanceBudget {
  readonly level: number;
  readonly consecutiveLowFpsReports: number;
}

export const INITIAL_INSTANCE_BUDGET: InstanceBudget = { level: 0, consecutiveLowFpsReports: 0 };

export function instanceCountOf(budget: InstanceBudget): number {
  return INSTANCE_COUNT_LEVELS[budget.level];
}

/** Folds one rolling-FPS report into the budget. */
export function reportFps(budget: InstanceBudget, fps: number): InstanceBudget {
  if (fps >= LOW_FPS_THRESHOLD) {
    return budget.consecutiveLowFpsReports === 0
      ? budget
      : { ...budget, consecutiveLowFpsReports: 0 };
  }
  const lowReports = budget.consecutiveLowFpsReports + 1;
  const isCheapest = budget.level >= INSTANCE_COUNT_LEVELS.length - 1;
  if (lowReports < LOW_FPS_REPORTS_TO_STEP_DOWN || isCheapest) {
    return { ...budget, consecutiveLowFpsReports: lowReports };
  }
  return { level: budget.level + 1, consecutiveLowFpsReports: 0 };
}
