import { isNumber } from 'lodash-es';

import { getFractionLength } from './getFractionLength';

test.each([
  { value: 0, expected: 0 },
  { value: 1, expected: 0 },
  { value: 100, expected: 0 },
  { value: 777.777e3, expected: 0 },
  { value: 777.777e4, expected: 0 },
  { value: 777.777e45, expected: 0 },
  { value: 1000.231e2, expected: 1 },
  { value: 1.231, expected: 3 },
  { value: 0.1111111111111111, expected: 16 },
  { value: 1.231e-7, expected: 10 },
  { value: 0.00000000000000000000000000001, expected: 29 },
  { value: 1e-44, expected: 44 },
  { value: 0.0000012897499999999998, expected: 22 },
  { value: Number.MAX_SAFE_INTEGER, expected: 0 },
  { value: Number.MAX_VALUE, expected: 0 },
  { value: Number.MIN_VALUE, expected: 324 },
  { value: Number.NaN, expected: Number.NaN },
  { value: Number.POSITIVE_INFINITY, expected: Number.NaN },
  { value: '', expected: Number.NaN },
  { value: '0', expected: 0 },
  { value: '1', expected: 0 },
  { value: '100', expected: 0 },
  { value: '777.777e3', expected: 0 },
  { value: '777.777e4', expected: 0 },
  { value: '777.777e45', expected: 0 },
  { value: '1000.231e2', expected: 1 },
  { value: '1.231', expected: 3 },
  { value: '0.1111111111111111', expected: 16 },
  { value: '1.231e-7', expected: 10 },
  { value: '0.00000000000000000000000000001', expected: 29 },
  { value: '1e-44', expected: 44 },
  { value: '0.0000012897499999999998', expected: 22 },
  { value: '0.000001289749999999999820398492187593481750291387420398740982374098', expected: 66 },
  {
    value: '0.000001289749999999999820398492187593481750291387420398740982374098e+66',
    expected: 0,
  },
  {
    value: '0.000001289749999999999820398492187593481750291387ZZZ420398740982374098e+66',
    expected: Number.NaN,
  },
])('getFractionLength $value', ({ value, expected }) => {
  expect(getFractionLength(value)).toBe(expected);
  if (isNumber(value)) {
    expect(getFractionLength(-value)).toBe(expected);
  } else {
    expect(getFractionLength(`-${value}`)).toBe(expected);
  }
});
