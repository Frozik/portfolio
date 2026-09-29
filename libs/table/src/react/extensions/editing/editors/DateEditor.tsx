import { isNil } from 'lodash-es';
import { useRef } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { assert } from '@frozik/utils/assert/assert';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import type { IParseContext } from '@frozik/utils/date/fuzzy/types';
import { getNowInstant } from '@frozik/utils/date/now';
import { isValidTimeZoneId } from '@frozik/utils/date/time-zone';

import type { IEditorProps } from '../editing-column';
import { useEditorFocus } from './useEditorFocus';

type TDateValue =
  | string
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDate
  | Temporal.PlainDateTime;

function toZoned(
  value: TDateValue | null | undefined,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
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
  original: TDateValue | null | undefined,
  picked: Temporal.ZonedDateTime | undefined
): TDateValue | undefined {
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

export function DateEditor<TRow>({
  draft,
  value,
  onChange,
  options,
  locale,
  column,
}: IEditorProps<TRow, TDateValue | null | undefined>) {
  const ref = useRef<IRichEditorHandle>(null);
  useEditorFocus(ref);
  const timeZone = options.timeZone ?? Temporal.Now.timeZoneId();
  assert(isValidTimeZoneId(timeZone), `column "${column.id}": unknown time zone "${timeZone}"`);
  const showTime = options.showTime ?? column.kind !== 'date';
  const parse = useEventCallback((text: string, context: IParseContext) =>
    parseFuzzyDate(text, { ...context, nearest: true })
  );
  const handleChange = useEventCallback((picked: Temporal.ZonedDateTime | undefined) =>
    onChange(likeOriginal(value, picked))
  );
  return (
    <DateTimePicker
      ref={ref}
      className="ft-editor-field"
      value={toZoned(draft, timeZone)}
      onValueChange={handleChange}
      getNow={getNowInstant}
      onParseInput={parse}
      timeZone={timeZone}
      showTime={showTime}
      locale={locale}
      nativePicker="never"
    />
  );
}
