import type { IRecurrence, TWeekday } from '../domain/schedule';

/** Google Calendar's «Does not repeat ▾» menu, plus weekends, which a call filter needs often. */
export type TRepeatPreset =
  | 'once'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

const WEEKDAYS: readonly TWeekday[] = [1, 2, 3, 4, 5];
const WEEKENDS: readonly TWeekday[] = [6, 7];

const sameDays = (left: readonly TWeekday[], right: readonly TWeekday[]) =>
  [...left].sort().join(',') === [...right].sort().join(',');

/** The recurrence a preset means, the start date picking its weekday for «weekly». */
export function presetRecurrence(
  preset: Exclude<TRepeatPreset, 'custom'>,
  startWeekday: TWeekday
): IRecurrence | null {
  const base = { interval: 1, monthly: null, end: { kind: 'never' as const } };
  switch (preset) {
    case 'once':
      return null;
    case 'daily':
      return { ...base, frequency: 'daily', weekdays: [] };
    case 'weekdays':
      return { ...base, frequency: 'weekly', weekdays: WEEKDAYS };
    case 'weekends':
      return { ...base, frequency: 'weekly', weekdays: WEEKENDS };
    case 'weekly':
      return { ...base, frequency: 'weekly', weekdays: [startWeekday] };
    case 'monthly':
      return { ...base, frequency: 'monthly', weekdays: [] };
    case 'yearly':
      return { ...base, frequency: 'yearly', weekdays: [] };
  }
}

/** Which menu item a recurrence is, «custom» when no preset says it. */
export function presetOf(repeat: IRecurrence | null, startWeekday: TWeekday): TRepeatPreset {
  if (repeat === null) {
    return 'once';
  }
  if (repeat.interval !== 1 || repeat.end.kind !== 'never' || repeat.monthly !== null) {
    return 'custom';
  }
  switch (repeat.frequency) {
    case 'daily':
      return 'daily';
    case 'weekly':
      if (sameDays(repeat.weekdays, WEEKDAYS)) {
        return 'weekdays';
      }
      if (sameDays(repeat.weekdays, WEEKENDS)) {
        return 'weekends';
      }
      return sameDays(repeat.weekdays, [startWeekday]) ? 'weekly' : 'custom';
    case 'monthly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
  }
}
