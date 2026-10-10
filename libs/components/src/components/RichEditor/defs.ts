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

export interface ITextSegment {
  readonly text: string;
  readonly className?: string;
}

/**
 * Splits the value into the segments shown in the field; `editing` is true while it has focus.
 * Segments are written as text nodes, so nothing in the value is ever parsed as markup.
 */
export type TSegmentRenderer = (text: string, editing: boolean) => readonly ITextSegment[];

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
  readonly toggleCalendar: string;
}
