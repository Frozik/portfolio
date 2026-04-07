import { trim } from './trim';

test.each([
  { value: '0.0000012897499999999998', fractionDecimals: 3, expected: '0' },
  { value: '-0.0000012897499999999998', fractionDecimals: 3, expected: '0' },
  {
    value: '0.000001289749999999999820398492187593481750291387420398740982374098e+66',
    fractionDecimals: 3,
    expected: '0.000001289749999999999820398492187593481750291387420398740982374098e+66',
  },
  {
    value: '0.001289749999999999820398492187593481750291387420398740982374098e+50',
    fractionDecimals: 3,
    expected: '0.00128974999999999982039849218759348175029138742039874e+50',
  },
  {
    value: '0.001289749999999999820398492187593481750291387420398740982374098e-50',
    fractionDecimals: 10,
    expected: '0',
  },
  {
    value: '0.001289749999999999820398492187593481750291387420398740982374098e-50',
    fractionDecimals: 54,
    expected: '0.0012e-50',
  },
  {
    value: '0.001289749999999999820398492187593481750291387420398740982374098e-150',
    fractionDecimals: 10,
    expected: '0',
  },
  {
    value: '012897499999.99999820398492187593481750291387420398740982374098e-1',
    fractionDecimals: 10,
    expected: '012897499999.999998203e-1',
  },
  {
    value: '0123456789.99999820398492187593481750291387420398740982374098e-1',
    fractionDecimals: 0,
    expected: '012345678',
  },
  {
    value: '0123456789.99999820398492187593481750291387420398740982374098',
    fractionDecimals: 0,
    expected: '0123456789',
  },
  {
    value: '0123456789.12345e2',
    fractionDecimals: 2,
    expected: '0123456789.1234e2',
  },
  {
    value: '1.2345e-2',
    fractionDecimals: 2,
    expected: '1e-2',
  },
  {
    value: '1.2345e-2',
    fractionDecimals: 4,
    expected: '1.23e-2',
  },
  { value: '0.0000012897499999999998', fractionDecimals: 7, expected: '0.0000012' },
  { value: '-0.0000012897499999999998', fractionDecimals: 7, expected: '-0.0000012' },
  { value: 0.0000012897499999999998, fractionDecimals: 7, expected: 0.0000012 },
  { value: -0.0000012897499999999998, fractionDecimals: 7, expected: -0.0000012 },
  { value: 1.2345e-100, fractionDecimals: 101, expected: 1.2e-100 },
  { value: 1.2345e-105, fractionDecimals: 105, expected: 1e-105 },
  { value: 1.2345e-105, fractionDecimals: 104, expected: 0 },
  { value: Number.MIN_VALUE, fractionDecimals: 324, expected: Number.MIN_VALUE },
  { value: Number.MIN_VALUE, fractionDecimals: 323, expected: 0 },
])('getFractionLength $value', ({ value, fractionDecimals, expected }) => {
  expect(trim(value as any, fractionDecimals)).toBe(expected);
});
