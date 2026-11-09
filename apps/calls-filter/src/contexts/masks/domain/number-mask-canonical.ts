import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { IDialingRegion } from '../../phone/domain/dialing-region';
import type { NumberMask } from './number-mask';
import type { IPatternElement, TPattern } from './pattern';
import { literalPattern } from './pattern';

/** Why a national mask has no international equivalent in the phone's home region. */
export type TCanonicalError =
  | { readonly kind: 'national-starts-with-wildcard'; readonly nationalPrefix: string }
  | { readonly kind: 'national-prefix-mismatch'; readonly nationalPrefix: string };

/** A lone `*` means any number at all, written with or without the plus. */
function isAnyNumber(pattern: TPattern): boolean {
  const [only, ...rest] = pattern;
  return rest.length === 0 && only?.symbol.kind === 'any' && only.min === 0 && only.max === null;
}

function consumeDigit(
  pattern: TPattern,
  digit: string,
  nationalPrefix: string
): TResult<TPattern, TCanonicalError> {
  const [first, ...rest] = pattern;
  if (first === undefined || first.min === 0) {
    return err({ kind: 'national-starts-with-wildcard', nationalPrefix });
  }
  if (first.symbol.kind === 'literal' && first.symbol.value !== digit) {
    return err({ kind: 'national-prefix-mismatch', nationalPrefix });
  }
  const remaining: IPatternElement = {
    ...first,
    min: first.min - 1,
    max: first.max === null ? null : first.max - 1,
  };
  return ok(remaining.max === 0 ? rest : [remaining, ...rest]);
}

/**
 * Every mask as international digits (E.164 without the plus), so that both runtimes match
 * one form only. A national mask is written the way the home country dials, trunk prefix
 * included (`8 921…`, `06…`): the prefix becomes the calling code (`+7 921…`, `+31 6…`).
 */
export function canonicalNumberPattern(
  mask: NumberMask,
  region: IDialingRegion
): TResult<TPattern, TCanonicalError> {
  if (mask.international || isAnyNumber(mask.pattern)) {
    return ok(mask.pattern);
  }
  let pattern: TPattern = mask.pattern;
  for (const digit of region.nationalPrefix ?? '') {
    const consumed = consumeDigit(pattern, digit, region.nationalPrefix ?? '');
    if (!consumed.ok) {
      return consumed;
    }
    pattern = consumed.value;
  }
  return ok([...literalPattern(region.callingCode), ...pattern]);
}
