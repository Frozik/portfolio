import { DETAIL_LEVELS, LOW_FPS_REPORTS_TO_STEP_DOWN, LOW_FPS_THRESHOLD } from './constants';

/**
 * Which entry of `DETAIL_LEVELS` is active and how long the frame rate has
 * been below the threshold at it. It only ever steps down: stepping back up
 * would raise the load, drop the FPS and step down again.
 */
export interface DetailBudget {
  readonly level: number;
  readonly consecutiveLowFpsReports: number;
}

export const INITIAL_DETAIL_BUDGET: DetailBudget = { level: 0, consecutiveLowFpsReports: 0 };

export function detailFactorOf(budget: DetailBudget): number {
  return DETAIL_LEVELS[budget.level];
}

export function reportFps(budget: DetailBudget, fps: number): DetailBudget {
  if (fps >= LOW_FPS_THRESHOLD) {
    return budget.consecutiveLowFpsReports === 0
      ? budget
      : { ...budget, consecutiveLowFpsReports: 0 };
  }
  const lowReports = budget.consecutiveLowFpsReports + 1;
  const isCheapest = budget.level >= DETAIL_LEVELS.length - 1;
  if (lowReports < LOW_FPS_REPORTS_TO_STEP_DOWN || isCheapest) {
    return { ...budget, consecutiveLowFpsReports: lowReports };
  }
  return { level: budget.level + 1, consecutiveLowFpsReports: 0 };
}
