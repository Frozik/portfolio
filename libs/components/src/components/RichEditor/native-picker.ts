import { ETimeResolution } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_MILLISECOND = 0.001;

export type TNativeInputType = 'date' | 'datetime-local';

export function nativeInputType(showTime: boolean): TNativeInputType {
  return showTime ? 'datetime-local' : 'date';
}

/** Step of a `datetime-local` input in seconds; a minute unless finer units are shown. */
export function nativeInputStep(resolution: ETimeResolution): number {
  switch (resolution) {
    case ETimeResolution.Milliseconds:
      return SECONDS_PER_MILLISECOND;
    case ETimeResolution.Seconds:
      return 1;
    default:
      return SECONDS_PER_MINUTE;
  }
}

function smallestUnitOf(resolution: ETimeResolution): 'minute' | 'second' | 'millisecond' {
  switch (resolution) {
    case ETimeResolution.Milliseconds:
      return 'millisecond';
    case ETimeResolution.Seconds:
      return 'second';
    default:
      return 'minute';
  }
}

/** The value attribute of the hidden native input for the current field value. */
export function toNativeInputValue(
  value: Temporal.ZonedDateTime | undefined,
  type: TNativeInputType,
  resolution: ETimeResolution
): string {
  if (isNil(value)) {
    return '';
  }
  return type === 'date'
    ? value.toPlainDate().toString()
    : value.toPlainDateTime().toString({ smallestUnit: smallestUnitOf(resolution) });
}

export function toNativeInputBound(
  date: Temporal.PlainDate | undefined,
  type: TNativeInputType
): string | undefined {
  if (isNil(date)) {
    return undefined;
  }
  return type === 'date' ? date.toString() : `${date.toString()}T00:00`;
}

/** The field value the native input reports; an empty input clears the field. */
export function fromNativeInputValue(
  text: string,
  type: TNativeInputType,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  if (text.length === 0) {
    return undefined;
  }
  return type === 'date'
    ? Temporal.PlainDate.from(text).toZonedDateTime({ timeZone })
    : Temporal.PlainDateTime.from(text).toZonedDateTime(timeZone);
}
