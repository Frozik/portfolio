export interface ISelection {
  readonly start: number;
  readonly end: number;
}

export interface INormalizedInput {
  readonly value: string;
  readonly selection: ISelection;
}

/** Accepts, rewrites or rejects (`undefined`) the text an edit would produce. */
export type TInputNormalizer = (
  value: string,
  selection: ISelection
) => INormalizedInput | undefined;

/** Renders the value as the HTML shown in the field; `editing` is true while it has focus. */
export type THtmlRenderer = (text: string, editing: boolean) => string;

export interface IRichEditorHandle {
  focus(): void;
  /** Moves the keyboard to the next tab stop after the field, or blurs when there is none. */
  focusNext(): void;
}

export type TLeaveDirection = 'forward' | 'backward';

export interface ICalendarAriaLabels {
  readonly dateInputLabel: string;
  readonly dateOnlyInputLabel: string;
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
  readonly calendarDays: string;
  readonly openNativePicker: string;
}
