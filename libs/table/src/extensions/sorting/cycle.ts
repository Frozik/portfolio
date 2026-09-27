import type { TSortDirection } from '../../core/rows/row-query';

export type TSortStep = TSortDirection | null;

export const DEFAULT_SORT_CYCLE: readonly TSortStep[] = ['asc', 'desc', null];

/** The direction after a click: the next step of the cycle from where the column is now. */
export function nextInCycle(cycle: readonly TSortStep[], current: TSortStep): TSortStep {
  const index = cycle.indexOf(current);
  return cycle[(index + 1) % cycle.length] ?? null;
}
