import { isNil } from 'lodash-es';
import { memo, useRef } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { assert } from '@frozik/utils/assert/assert';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import type { IParseContext } from '@frozik/utils/date/fuzzy/types';
import { getNowInstant } from '@frozik/utils/date/now';
import { isValidTimeZoneId } from '@frozik/utils/date/time-zone';

import type { ICellProps, TCellComponent } from '../column';
import { useTableContext } from '../context';
import { useFieldFocus } from './useFieldFocus';

export interface IDateCellOptions {
  readonly timeZone?: string;
  /** Defaults to the column kind: time for `datetime`, none for `date`. */
  readonly showTime?: boolean;
}

export type TDateValue =
  | string
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | null
  | undefined;

function toZoned(value: TDateValue, timeZone: string): Temporal.ZonedDateTime | undefined {
  if (isNil(value) || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.includes('T')
      ? Temporal.Instant.from(value).toZonedDateTimeISO(timeZone)
      : Temporal.PlainDate.from(value).toZonedDateTime(timeZone);
  }
  if (value instanceof Temporal.Instant) {
    return value.toZonedDateTimeISO(timeZone);
  }
  if (value instanceof Temporal.PlainDate || value instanceof Temporal.PlainDateTime) {
    return value.toZonedDateTime(timeZone);
  }
  return value;
}

/** The picked moment in the representation the cell already used, so `set` receives what `value` returns. */
function likeOriginal(
  original: TDateValue,
  picked: Temporal.ZonedDateTime | undefined
): TDateValue {
  if (picked === undefined) {
    return undefined;
  }
  if (typeof original === 'string') {
    return original.includes('T') ? picked.toInstant().toString() : picked.toPlainDate().toString();
  }
  if (original instanceof Temporal.Instant) {
    return picked.toInstant();
  }
  if (original instanceof Temporal.PlainDate) {
    return picked.toPlainDate();
  }
  if (original instanceof Temporal.PlainDateTime) {
    return picked.toPlainDateTime();
  }
  return picked;
}

function DateField<TRow>({
  value,
  edit,
  column,
  options,
}: ICellProps<TRow, TDateValue> & { readonly options: IDateCellOptions }) {
  const { locale } = useTableContext();
  const ref = useRef<IRichEditorHandle>(null);
  useFieldFocus(ref);
  const timeZone = options.timeZone ?? Temporal.Now.timeZoneId();
  assert(isValidTimeZoneId(timeZone), `column "${column.id}": unknown time zone "${timeZone}"`);
  const parse = useEventCallback((text: string, context: IParseContext) =>
    parseFuzzyDate(text, { ...context, nearest: true })
  );
  const handleChange = useEventCallback((picked: Temporal.ZonedDateTime | undefined) =>
    edit.update(likeOriginal(value, picked))
  );
  return (
    <DateTimePicker
      ref={ref}
      className="ft-cell-field"
      value={toZoned(edit.draft, timeZone)}
      onValueChange={handleChange}
      getNow={getNowInstant}
      onParseInput={parse}
      timeZone={timeZone}
      showTime={options.showTime ?? column.kind !== 'date'}
      locale={locale}
      nativePicker="never"
    />
  );
}

/** The formatted date in view mode, a date-time picker in edit mode. */
export function dateCell<TRow>(options: IDateCellOptions = {}): TCellComponent<TRow, TDateValue> {
  return memo(function DateCell(props: ICellProps<TRow, TDateValue>) {
    return props.mode === 'edit' ? <DateField {...props} options={options} /> : props.text;
  });
}

export const DateCell = dateCell<unknown>();
