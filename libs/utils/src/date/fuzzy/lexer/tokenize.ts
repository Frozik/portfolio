import { classify } from './classify';
import { joinDecimals } from './decimals';
import { mergePhrases } from './merge-phrases';
import { scan } from './scanner';
import type { Token } from './token';
import { ETokenKind } from './token';

const ISO_TIME_DESIGNATOR = /(\d)T(\d)/;
const DASHES = /[‐-―−]/g;
const COMPATIBILITY_FORM = 'NFKC';

/**
 * Text copied from a page comes with its typography: a non-breaking space, full-width
 * digits, a dash that is not the one on the keyboard. "2024-01-15T14:30" is the one form
 * where a letter separates two numbers.
 */
function asTyped(text: string): string {
  return text
    .normalize(COMPATIBILITY_FORM)
    .replace(DASHES, '-')
    .replace(ISO_TIME_DESIGNATOR, '$1 $2');
}

export function tokenize(text: string): readonly Token[] {
  return mergePhrases(joinDecimals(scan(asTyped(text))).flatMap(classify)).filter(
    token => token.kind !== ETokenKind.Filler
  );
}
