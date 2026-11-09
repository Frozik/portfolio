import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IPatternElement, TPattern, TPatternSymbol } from './pattern';

/** What `.`, `*` and `{n}` stand for: a digit in a number, any character in a name. */
export type TPatternAlphabet = 'digits' | 'text';

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\/-]/g;

function symbolSource(symbol: TPatternSymbol, alphabet: TPatternAlphabet): string {
  switch (symbol.kind) {
    case 'literal':
      return symbol.value.replace(REGEX_SPECIAL, '\\$&');
    case 'any':
      return alphabet === 'digits' ? '\\d' : '[\\s\\S]';
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
 * The anchored regular expression both runtimes execute: JavaScript `RegExp` and Kotlin
 * `Regex` agree on this subset (literals, `\d`, `[\s\S]`, bounded repetition), and the
 * shared fixtures prove it.
 */
export function patternRegexSource(pattern: TPattern, alphabet: TPatternAlphabet): string {
  const body = pattern
    .map(element => {
      const quantifier = quantifierSource(element);
      const symbol = symbolSource(element.symbol, alphabet);
      return quantifier === '' ? symbol : `(?:${symbol})${quantifier}`;
    })
    .join('');
  return `^${body}$`;
}
