import type { EDayOfWeek } from '../../constants';
import type { ESeparator } from './lexeme';

export enum ETokenKind {
  Number = 'Number',
  Year = 'Year',
  Ordinal = 'Ordinal',
  MonthName = 'MonthName',
  WeekdayName = 'WeekdayName',
  RelativeWeekday = 'RelativeWeekday',
  DateKeyword = 'DateKeyword',
  Boundary = 'Boundary',
  Weekend = 'Weekend',
  Offset = 'Offset',
  Quarter = 'Quarter',
  ClockTime = 'ClockTime',
  TimeKeyword = 'TimeKeyword',
  DayPart = 'DayPart',
  Meridiem = 'Meridiem',
  ZoneOffset = 'ZoneOffset',
  Direction = 'Direction',
  Unit = 'Unit',
  Filler = 'Filler',
  Unknown = 'Unknown',
}

export enum EDateKeyword {
  Today = 'Today',
  Tomorrow = 'Tomorrow',
  Yesterday = 'Yesterday',
  Now = 'Now',
}

export enum EEdge {
  Start = 'Start',
  End = 'End',
}

export enum EPeriod {
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
  Quarter = 'Quarter',
  Year = 'Year',
}

export enum EOffsetUnit {
  Second = 'Second',
  Minute = 'Minute',
  Hour = 'Hour',
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
  Year = 'Year',
}

export enum EDirection {
  Last = 'Last',
  This = 'This',
  Next = 'Next',
}

export enum EMeridiem {
  Am = 'Am',
  Pm = 'Pm',
}

export type Meaning =
  | { readonly kind: ETokenKind.Number; readonly value: number }
  | { readonly kind: ETokenKind.Year; readonly year: number }
  | { readonly kind: ETokenKind.Ordinal; readonly day: number }
  | { readonly kind: ETokenKind.MonthName; readonly month: number }
  | { readonly kind: ETokenKind.WeekdayName; readonly weekday: EDayOfWeek }
  | {
      readonly kind: ETokenKind.RelativeWeekday;
      readonly weekday: EDayOfWeek;
      readonly direction: EDirection;
    }
  | { readonly kind: ETokenKind.DateKeyword; readonly keyword: EDateKeyword }
  | {
      readonly kind: ETokenKind.Boundary;
      readonly edge: EEdge;
      readonly period: EPeriod;
      /** Which period it is the edge of: 0 for the one today falls in, 1 for the next, -1 for the last. */
      readonly periodsAhead: number;
    }
  | { readonly kind: ETokenKind.Offset; readonly amount: number; readonly unit: EOffsetUnit }
  /** The Saturday of a week: 0 for the week today falls in, 1 for the next, -1 for the last. */
  | { readonly kind: ETokenKind.Weekend; readonly weeksAhead: number }
  | { readonly kind: ETokenKind.Quarter; readonly quarter: number }
  | {
      readonly kind: ETokenKind.ClockTime;
      readonly hour: number;
      readonly minute: number;
      readonly second?: number;
      readonly millisecond?: number;
    }
  | { readonly kind: ETokenKind.TimeKeyword; readonly hour: number }
  /** "evening": an hour of the dial it usually means, and the half of the day an hour beside it falls in. */
  | { readonly kind: ETokenKind.DayPart; readonly hour: number; readonly meridiem: EMeridiem }
  | { readonly kind: ETokenKind.Meridiem; readonly meridiem: EMeridiem }
  /** `zone` is a time zone identifier `Temporal` takes: "UTC" or an offset such as "+02:00". */
  | { readonly kind: ETokenKind.ZoneOffset; readonly zone: string }
  | { readonly kind: ETokenKind.Direction; readonly direction: EDirection }
  | { readonly kind: ETokenKind.Unit; readonly unit: EOffsetUnit }
  /** A word that only joins the others — "at", "on", "of", "the" — and is dropped once the phrases are read. */
  | { readonly kind: ETokenKind.Filler }
  | { readonly kind: ETokenKind.Unknown };

export interface IWritten {
  /** The lexeme the token was read from; several tokens share it when a lexeme holds more than one. */
  readonly text: string;
  readonly joint?: ESeparator;
}

export type Token = Meaning & IWritten;

export type TokenOf<Kind extends ETokenKind> = Extract<Token, { readonly kind: Kind }>;
