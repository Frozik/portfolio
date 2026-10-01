import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';

/** An interval this far from the median is a dropped or doubled frame, not the display's cadence. */
const OUTLIER_SHARE = 0.25;
/** Rates displays are actually sold with; a measured rate this close to one is shown as that one. */
const COMMON_RATES_HZ = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240, 360] as const;
const SNAP_SHARE = 0.03;

/**
 * The display's frame interval read off the gaps between animation frames of
 * an idle page. The median finds the cadence and the mean of the gaps near it
 * gives the value: Safari rounds its clock to a millisecond, so a median alone
 * would call 16.67 ms "17".
 */
export function refreshIntervalOf(intervalsMs: readonly number[]): number | undefined {
  if (intervalsMs.length === 0) {
    return undefined;
  }
  const sorted = [...intervalsMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const steady = sorted.filter(interval => Math.abs(interval - median) <= median * OUTLIER_SHARE);
  const sum = steady.reduce((total, interval) => total + interval, 0);
  return sum > 0 ? sum / steady.length : undefined;
}

/** The refresh rate in hertz for showing: the common rate it sits next to, else the rounded measurement. */
export function refreshRateOf(intervalMs: number): number {
  const measured = MS_PER_SECOND / intervalMs;
  const common = COMMON_RATES_HZ.find(rate => Math.abs(rate - measured) <= rate * SNAP_SHARE);
  return isNil(common) ? Math.round(measured) : common;
}
