import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IPatternElement, TPattern, TPatternSymbol } from './pattern';

/**
 * The characters a literal escapes. Not `-`: it means something only inside `[…]`, where no literal
 * goes, and the `u` flag refuses `\-` outside it.
 */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\/]/g;

function symbolSource(symbol: TPatternSymbol): string {
  switch (symbol.kind) {
    case 'literal':
      return symbol.value.replace(REGEX_SPECIAL, '\\$&');
    case 'any':
      return '\\d';
    default:
      return assertNever(symbol);
  }
}

function quantifierSource(element: IPatternElement): string {
  if (element.min === 1 && element.max === 1) {
    return '';
  }
  if (element.max === null) {
    return element.min === 0 ? '*' : `{${element.min},}`;
  }
  return element.min === element.max ? `{${element.min}}` : `{${element.min},${element.max}}`;
}

/**
 * The anchored regular expression over a number's digits both runtimes execute: JavaScript
 * `RegExp` and Kotlin `Regex` agree on this subset (literals, `\d`, bounded repetition), and
 * the shared fixtures prove it.
 */
export function patternRegexSource(pattern: TPattern): string {
  const body = pattern
    .map(element => {
      const quantifier = quantifierSource(element);
      const symbol = symbolSource(element.symbol);
      return quantifier === '' ? symbol : `(?:${symbol})${quantifier}`;
    })
    .join('');
  return `^${body}$`;
}
