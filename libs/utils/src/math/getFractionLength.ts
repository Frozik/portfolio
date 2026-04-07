import { isEmpty, isNumber } from 'lodash-es';

import { FLOAT_DECIMALS_SEPARATOR, FLOAT_EXPONENT_MARKER } from './defs';

export function getFractionLength(value: number | string): number {
  if (
    isNumber(value)
      ? Number.isNaN(value) || !Number.isFinite(value)
      : isEmpty(value) || !/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(value)
  ) {
    return Number.NaN;
  }

  const [numberPart, exponentPart = '0'] = (isNumber(value) ? value.toString() : value).split(
    FLOAT_EXPONENT_MARKER
  );

  const exponent = Number.parseInt(exponentPart, 10);
  const numberDigits = numberPart.split(FLOAT_DECIMALS_SEPARATOR)[1]?.length ?? 0;

  return Math.max(numberDigits - exponent, 0);
}
