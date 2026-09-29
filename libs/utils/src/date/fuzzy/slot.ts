export enum ESlot {
  Year = 'year',
  Month = 'month',
  Day = 'day',
  Hour = 'hour',
  Minute = 'minute',
  Second = 'second',
  Millisecond = 'millisecond',
}

export const DATE_SLOTS: readonly ESlot[] = [ESlot.Year, ESlot.Month, ESlot.Day];

export const TIME_SLOTS: readonly ESlot[] = [
  ESlot.Hour,
  ESlot.Minute,
  ESlot.Second,
  ESlot.Millisecond,
];

export const ALL_SLOTS: readonly ESlot[] = [...DATE_SLOTS, ...TIME_SLOTS];

export type SlotValues = Readonly<Partial<Record<ESlot, number>>>;
