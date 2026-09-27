import { isNil } from 'lodash-es';
import { useRef } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';

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
  const showTime = options.showTime ?? column.kind !== 'date';
  const parse = useEventCallback((text: string) =>
    parseFuzzyDate(text, { now: Temporal.Now.zonedDateTimeISO(timeZone), nearest: true })
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
      onParseInput={parse}
      timeZone={timeZone}
      showTime={showTime}
      locale={locale}
      nativePicker="never"
    />
  );
}
