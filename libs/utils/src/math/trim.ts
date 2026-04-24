import { isEmpty, isNumber } from 'lodash-es';

import { assert } from '../assert/assert';
import { FLOAT_DECIMALS_SEPARATOR, FLOAT_EXPONENT_MARKER } from './defs';
import { getFractionLength } from './getFractionLength';

export function trim(value: number, fractionDecimals: number): number;
export function trim(value: string, fractionDecimals: number): string;
export function trim(value: number | string, fractionDecimals: number): number | string {
  assert(fractionDecimals >= 0, 'fractionDecimals must be greater than or equal to 0');

  if (
    isNumber(value)
      ? Number.isNaN(value) || !Number.isFinite(value)
      : isEmpty(value) || !/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(value)
  ) {
    return value;
  }

  const fractionLength = getFractionLength(value);

  if (fractionDecimals >= fractionLength) {
    return value;
  }

  const removeDecimals = fractionLength - fractionDecimals;

  const stringValue = isNumber(value) ? value.toString() : value;

  if (stringValue.includes(FLOAT_EXPONENT_MARKER)) {
    const [valuePart, exponentPart] = stringValue.split(FLOAT_EXPONENT_MARKER);
    const exponent = Number.parseInt(exponentPart, 10);
    const fractionLengthValuePart = getFractionLength(valuePart);

    const forceSign = /[+-]/.test(exponentPart);

    const diffFractionLength = fractionLengthValuePart - removeDecimals;

    let newValuePart: string;
    let newExponent: number;
    if (diffFractionLength >= 0) {
      newValuePart = valuePart.substring(0, valuePart.length - removeDecimals);
      newExponent = exponent;
    } else {
      const separatorIndex = Math.max(0, valuePart.indexOf(FLOAT_DECIMALS_SEPARATOR));

      newValuePart = valuePart.substring(0, separatorIndex + diffFractionLength);
      newExponent = exponent - diffFractionLength;
    }

    const newValue = normalizeStringValue(
      `${newValuePart}${newExponent === 0 ? '' : `${FLOAT_EXPONENT_MARKER}${forceSign && newExponent > 0 ? '+' : ''}${newExponent}`}`
    );

    return isNumber(value) ? Number.parseFloat(newValue) || 0 : newValue;
  }

  if (!stringValue.includes(FLOAT_DECIMALS_SEPARATOR)) {
    return value;
  }

  const newValue = normalizeStringValue(
    stringValue.substring(0, stringValue.length - removeDecimals)
  );

  return isNumber(value) ? Number.parseFloat(newValue) || 0 : newValue;
}

function normalizeStringValue(value: string): string {
  if (/^[-+]?0*\.?0*([eE][-+]?[0-9]+)?$/.test(value)) {
    return '0';
  }
  const [valuePart, exponentPart] = value.split(FLOAT_EXPONENT_MARKER);

  return `${valuePart.endsWith(FLOAT_DECIMALS_SEPARATOR) ? valuePart.substring(0, valuePart.length - 1) : valuePart}${isEmpty(exponentPart) ? '' : `${FLOAT_EXPONENT_MARKER}${exponentPart}`}`;
}
