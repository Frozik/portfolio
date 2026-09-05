import { clamp, isEmpty, isNil } from 'lodash-es';

import type { INormalizedInput, ISelection, THtmlRenderer, TInputNormalizer } from './defs';
import styles from './styles.module.scss';

const MAX_DIGITS = 50;
const MAX_SIGNIFICANT_DIGITS = 15;
const DIGITS_PER_GROUP = 3;
const DEFAULT_PIP_SIZE = 2;

const FAST_INPUT_SUFFIX_ZEROS: Readonly<Record<string, string>> = {
  k: '000',
  m: '000000',
  b: '000000000',
};

function expandFastInputSuffix(value: string, selection: ISelection): INormalizedInput | undefined {
  const suffixes = value.replace(/[^kmb]/gi, '');
  if (suffixes.length === 0) {
    return { value, selection };
  }
  if (suffixes.length > 1) {
    return undefined;
  }

  const zeros = FAST_INPUT_SUFFIX_ZEROS[suffixes.toLowerCase()] ?? '';
  const expanded = value.replace(suffixes, zeros);

  return {
    value: expanded,
    selection: {
      start: Math.min(expanded.length, selection.start + zeros.length),
      end: Math.min(expanded.length, selection.end + zeros.length),
    },
  };
}

/**
 * Accepts digits with at most one decimal point (and a leading minus when
 * allowed); a trailing `k`/`m`/`b` expands to thousands/millions/billions.
 */
export function createNumericInputNormalizer({
  allowNegative = false,
}: {
  readonly allowNegative?: boolean;
}): TInputNormalizer {
  const pattern = allowNegative ? /^-?[0-9.]*$/ : /^[0-9.]*$/;

  return (rawValue, rawSelection) => {
    const expanded = expandFastInputSuffix(rawValue, rawSelection);
    if (isNil(expanded)) {
      return undefined;
    }

    const { value } = expanded;
    if (!pattern.test(value) || value.indexOf('.') !== value.lastIndexOf('.')) {
      return undefined;
    }

    const digits = value.replace(/[.-]/g, '');
    const significant = digits.replace(/^0+|0+$/g, '');
    if (digits.length > MAX_DIGITS || significant.length > MAX_SIGNIFICANT_DIGITS) {
      return undefined;
    }

    return expanded;
  };
}

interface INumericParts {
  readonly negative: boolean;
  readonly integer: string;
  readonly fraction: string | undefined;
}

function splitNumericText(text: string): INumericParts {
  const negative = text.startsWith('-');
  const [integer, fraction] = (negative ? text.slice(1) : text).split('.');

  return { negative, integer, fraction };
}

/**
 * Wraps digits in group / pip spans by their power of ten. Out of focus the
 * fraction is padded to the display scale so the field reads as a formatted
 * number; while editing the text is shown exactly as typed.
 */
export function createNumericHtmlRenderer({
  decimal,
  pipStart,
  pipSize = DEFAULT_PIP_SIZE,
}: {
  readonly decimal?: number;
  readonly pipStart?: number;
  readonly pipSize?: number;
}): THtmlRenderer {
  const displayScale = Math.max(decimal ?? 0, isNil(pipStart) ? 0 : pipStart + pipSize);
  const pipRange = isNil(pipStart)
    ? undefined
    : { high: -pipStart, low: -(pipStart + pipSize - 1) };

  const classesOf = (power: number, leadingPower: number): string =>
    [
      power > 0 && power % DIGITS_PER_GROUP === 0 ? styles.groupEnd : '',
      power >= 0 && power % DIGITS_PER_GROUP === DIGITS_PER_GROUP - 1 && power !== leadingPower
        ? styles.groupStart
        : '',
      !isNil(pipRange) && power <= pipRange.high && power >= pipRange.low ? styles.pip : '',
    ]
      .filter(className => !isEmpty(className))
      .join(' ');

  const digitHtml = (digit: string, power: number, leadingPower: number): string => {
    const classes = classesOf(power, leadingPower);
    return isEmpty(classes) ? digit : `<span class="${classes}">${digit}</span>`;
  };

  return (text, editing) => {
    if (isEmpty(text)) {
      return '';
    }

    const { negative, integer, fraction } = splitNumericText(text);
    const fractionDigits = editing ? (fraction ?? '') : (fraction ?? '').padEnd(displayScale, '0');
    const leadingPower = integer.length - 1;

    const integerHtml = Array.from(integer, (digit, index) =>
      digitHtml(digit, leadingPower - index, leadingPower)
    ).join('');
    const fractionHtml = Array.from(fractionDigits, (digit, index) =>
      digitHtml(digit, -(index + 1), leadingPower)
    ).join('');
    const separator = !isNil(fraction) || fractionDigits.length > 0 ? '.' : '';

    return `${negative ? '-' : ''}${integerHtml}${separator}${fractionHtml}`;
  };
}

/** Empty, partial (`-`, `.`) or non-finite text has no committed value. */
export function parseNumericText(text: string): number | undefined {
  if (text.length === 0) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const PLAIN_NUMBER_FORMAT = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  maximumFractionDigits: 20,
});

/** Plain decimal text without exponent notation, so it survives the input policy. */
export function formatNumericValue(value: number | undefined): string {
  return isNil(value) ? '' : PLAIN_NUMBER_FORMAT.format(value);
}

/** Half-up rounding on the decimal text itself, so `1.005` at two decimals is `1.01`. */
export function roundNumericText(text: string, decimals: number): string {
  const { negative, integer, fraction } = splitNumericText(text);
  if (isNil(fraction) || fraction.length <= decimals) {
    return text;
  }

  const kept = fraction.slice(0, decimals);
  const roundUp = fraction.charCodeAt(decimals) >= '5'.charCodeAt(0);
  const scaled = BigInt(`${integer || '0'}${kept}`) + (roundUp ? 1n : 0n);
  const scaledText = scaled.toString().padStart(decimals + 1, '0');
  const integerText = scaledText.slice(0, scaledText.length - decimals);
  const fractionText = scaledText.slice(scaledText.length - decimals);
  const sign = negative && scaled !== 0n ? '-' : '';

  return decimals === 0 ? `${sign}${integerText}` : `${sign}${integerText}.${fractionText}`;
}

/** The text a field settles on when it loses focus: rounded to its scale and kept within bounds. */
export function settleNumericText(
  text: string,
  {
    decimals,
    min,
    max,
  }: { readonly decimals?: number; readonly min?: number; readonly max?: number }
): string {
  const value = parseNumericText(text);
  if (isNil(value)) {
    return text;
  }

  const bounded = clamp(value, min ?? Number.NEGATIVE_INFINITY, max ?? Number.POSITIVE_INFINITY);
  const boundedText = bounded === value ? text : formatNumericValue(bounded);

  if (isNil(decimals)) {
    return boundedText.includes('.') ? boundedText.replace(/\.?0+$/, '') : boundedText;
  }

  return roundNumericText(boundedText, decimals);
}
