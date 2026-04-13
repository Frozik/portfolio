export interface ISelection {
  readonly start: number;
  readonly end: number;
}

export interface ICalendarAriaLabels {
  readonly dateInputLabel: string;
  readonly numericInputLabel: string;
  readonly datePicker: string;
  readonly monthNavigation: string;
  readonly previousYear: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly nextYear: string;
  readonly time: string;
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
  readonly milliseconds: string;
  readonly increaseHours: string;
  readonly decreaseHours: string;
  readonly increaseMinutes: string;
  readonly decreaseMinutes: string;
  readonly increaseSeconds: string;
  readonly decreaseSeconds: string;
  readonly increaseMilliseconds: string;
  readonly decreaseMilliseconds: string;
  readonly monthNames: readonly string[];
  readonly dayNames: readonly string[];
  readonly dayNamesShort: readonly string[];
}
