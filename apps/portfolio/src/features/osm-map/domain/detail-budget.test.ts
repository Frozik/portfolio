import { DETAIL_LEVELS, LOW_FPS_REPORTS_TO_STEP_DOWN, LOW_FPS_THRESHOLD } from './constants';
import { detailFactorOf, INITIAL_DETAIL_BUDGET, reportFps } from './detail-budget';

describe('detail budget', () => {
  it('steps down only after sustained low frame rates', () => {
    let budget = INITIAL_DETAIL_BUDGET;
    for (let report = 0; report < LOW_FPS_REPORTS_TO_STEP_DOWN - 1; report++) {
      budget = reportFps(budget, LOW_FPS_THRESHOLD - 1);
    }
    expect(detailFactorOf(budget)).toBe(DETAIL_LEVELS[0]);

    budget = reportFps(budget, LOW_FPS_THRESHOLD - 1);

    expect(detailFactorOf(budget)).toBe(DETAIL_LEVELS[1]);
  });

  it('forgets low reports once the frame rate recovers and never steps back up', () => {
    let budget = reportFps(INITIAL_DETAIL_BUDGET, LOW_FPS_THRESHOLD - 1);
    budget = reportFps(budget, LOW_FPS_THRESHOLD);
    expect(budget.consecutiveLowFpsReports).toBe(0);

    let cheapest = { level: DETAIL_LEVELS.length - 1, consecutiveLowFpsReports: 0 };
    for (let report = 0; report < LOW_FPS_REPORTS_TO_STEP_DOWN * 2; report++) {
      cheapest = reportFps(cheapest, LOW_FPS_THRESHOLD - 1);
    }
    expect(cheapest.level).toBe(DETAIL_LEVELS.length - 1);
  });
});
