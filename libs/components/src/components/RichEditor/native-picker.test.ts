import { ETimeResolution } from '@frozik/utils/date/constants';
import { Temporal } from 'temporal-polyfill';

import {
  fromNativeInputValue,
  nativeInputStep,
  toNativeInputBound,
  toNativeInputValue,
} from './native-picker';

const value = Temporal.ZonedDateTime.from('2026-03-10T14:05:07.123[UTC]');

describe('toNativeInputValue', () => {
  it('prints a date for the date input', () => {
    expect(toNativeInputValue(value, 'date', ETimeResolution.Minutes)).toBe('2026-03-10');
  });

  it('prints the time down to the shown resolution for datetime-local', () => {
    expect(toNativeInputValue(value, 'datetime-local', ETimeResolution.Minutes)).toBe(
      '2026-03-10T14:05'
    );
    expect(toNativeInputValue(value, 'datetime-local', ETimeResolution.Milliseconds)).toBe(
      '2026-03-10T14:05:07.123'
    );
  });

  it('is empty without a value', () => {
    expect(toNativeInputValue(undefined, 'date', ETimeResolution.Minutes)).toBe('');
  });
});

describe('fromNativeInputValue', () => {
  it('reads the native value back in the field time zone', () => {
    expect(fromNativeInputValue('2026-03-10T14:05', 'datetime-local', 'UTC')?.toString()).toBe(
      '2026-03-10T14:05:00+00:00[UTC]'
    );
    expect(fromNativeInputValue('2026-03-10', 'date', 'Europe/Moscow')?.toString()).toBe(
      '2026-03-10T00:00:00+03:00[Europe/Moscow]'
    );
  });

  it('clears the field for an empty input', () => {
    expect(fromNativeInputValue('', 'date', 'UTC')).toBeUndefined();
  });
});

describe('native input attributes', () => {
  it('steps in seconds according to the resolution', () => {
    expect(nativeInputStep(ETimeResolution.Minutes)).toBe(60);
    expect(nativeInputStep(ETimeResolution.Seconds)).toBe(1);
    expect(nativeInputStep(ETimeResolution.Milliseconds)).toBe(0.001);
  });

  it('formats bounds for both input types', () => {
    const bound = Temporal.PlainDate.from('2026-01-01');
    expect(toNativeInputBound(bound, 'date')).toBe('2026-01-01');
    expect(toNativeInputBound(bound, 'datetime-local')).toBe('2026-01-01T00:00');
    expect(toNativeInputBound(undefined, 'date')).toBeUndefined();
  });
});
