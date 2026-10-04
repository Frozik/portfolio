import { isNil } from 'lodash-es';

import { createNumericInputNormalizer, parseNumericText, settleNumericText } from './numeric-input';

const DEFAULT_PIP_SIZE = 2;

/** How a numeric field rounds, clamps and highlights what it settles. */
export interface INumericFieldFormat {
  readonly decimal?: number;
  readonly pipStart?: number;
  readonly pipSize?: number;
  readonly allowNegative?: boolean;
  readonly min?: number;
  readonly max?: number;
}

export type NumericEntry = { readonly value: number | undefined } | { readonly error: string };

/** Fraction digits the field shows: enough for the decimals and for the pip digits. */
export function numericDisplayScale({
  decimal,
  pipStart,
  pipSize = DEFAULT_PIP_SIZE,
}: INumericFieldFormat): number {
  return Math.max(Math.max(decimal ?? 0, 0), isNil(pipStart) ? 0 : pipStart + pipSize);
}

/** Fraction digits a settled value is rounded to; `undefined` keeps what was typed. */
export function settledDecimals(format: INumericFieldFormat): number | undefined {
  return isNil(format.decimal) && isNil(format.pipStart) ? undefined : numericDisplayScale(format);
}

/**
 * The value a field ends up with when `text` is typed into it and the field is left:
 * the same normalisation (`k`/`m`/`b` suffixes, one decimal point, the sign rule),
 * rounding and clamping the editor applies. Text the editor would refuse to accept
 * comes back as an error.
 */
export function enterNumericText(text: string, format: INumericFieldFormat): NumericEntry {
  const trimmed = text.trim();
  const normalized = createNumericInputNormalizer({ allowNegative: format.allowNegative })(
    trimmed,
    { start: trimmed.length, end: trimmed.length }
  );
  if (isNil(normalized)) {
    return { error: `"${text}" is not a number this field accepts.` };
  }
  const settled = settleNumericText(normalized.value, {
    decimals: settledDecimals(format),
    min: format.min,
    max: format.max,
  });
  return { value: parseNumericText(settled) };
}
