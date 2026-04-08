export enum ETokenKind {
  Number = 'Number',
  Keyword = 'Keyword',
  TimeKeyword = 'TimeKeyword',
  BoundaryKeyword = 'BoundaryKeyword',
  MonthName = 'MonthName',
  WeekdayName = 'WeekdayName',
  AmPm = 'AmPm',
  Direction = 'Direction',
  Unit = 'Unit',
  Quarter = 'Quarter',
  ColonTime = 'ColonTime',
  Offset = 'Offset',
  Duration = 'Duration',
  Ordinal = 'Ordinal',
  Unknown = 'Unknown',
}

export interface IToken {
  readonly kind: ETokenKind;
  readonly raw: string;
  readonly value: number;
  readonly extra?: string;
}

export type ESlot = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'ms';

export interface ISlotMap {
  day?: number;
  month?: number;
  year?: number;
  hour?: number;
  minute?: number;
  second?: number;
  ms?: number;
}

export const ALL_SLOTS: readonly ESlot[] = [
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'ms',
];

export interface ICandidate {
  readonly token: IToken;
  readonly index: number;
  scores: Record<ESlot, number>;
}

export interface ISlotContext {
  readonly hasDateKeyword: boolean;
  readonly hasBoundaryKeyword: boolean;
  readonly hasMonthName: boolean;
  readonly hasTimeKeyword: boolean;
  readonly hasColonTime: boolean;
  readonly hasOrdinal: boolean;
  readonly hasAmPm: boolean;
}
