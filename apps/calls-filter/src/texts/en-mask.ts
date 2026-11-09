import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TMaskToken } from '../contexts/masks/domain/mask-description';
import { plural } from './plural';
import type { ITexts } from './texts';

const count = (value: number, one: string, other: string) =>
  plural('en', value, { one: `# ${one}`, other: `# ${other}` });

function times(min: number, max: number | null): string {
  if (max === null) {
    return min === 0 ? 'any number of times' : `${min} or more times`;
  }
  if (min === max) {
    return min === 1 ? 'once' : `${min} times`;
  }
  return `${min}–${max} times`;
}

function describeToken(token: TMaskToken): string {
  switch (token.kind) {
    case 'text':
      return `“${token.text}”`;
    case 'repeat':
      return `“${token.text}” ${times(token.min, token.max)}`;
    case 'any':
      if (token.max === null) {
        return token.min === 0 ? 'anything' : `at least ${count(token.min, 'symbol', 'symbols')}`;
      }
      return token.min === token.max
        ? `any ${count(token.min, 'symbol', 'symbols')}`
        : `any ${token.min}–${token.max} symbols`;
    default:
      return assertNever(token);
  }
}

/** The mask editor's words: the mask read aloud, its errors, its tools. */
export const EN_MASK: ITexts['mask'] = {
  title: 'Mask',
  number: 'Number',
  name: 'Name',
  field: 'Look in',
  placeholderNumber: '+31 6 ........',
  placeholderName: '*delivery*',
  check: 'Check',
  matches: 'matches',
  noMatch: 'does not match',
  example: text => `For example: ${text}`,
  describe: (tokens, international) => {
    const parts = tokens.map(describeToken);
    const start = international ? '+' : '';
    return `${start}${parts.join(', then ')}`;
  },
  error: error => {
    switch (error.kind) {
      case 'empty':
        return 'The mask is empty';
      case 'plus-not-first':
        return `«+» only at the start (position ${error.position + 1})`;
      case 'quantifier-without-symbol':
        return `{…} needs a digit or «.» before it (position ${error.position + 1})`;
      case 'quantifier-after-star':
        return `«*» already means any number of digits (position ${error.position + 1})`;
      case 'quantifier-malformed':
        return `Write a repeat as {3}, {1,2} or {2,} (position ${error.position + 1})`;
      case 'quantifier-min-above-max':
        return `The first number of {…} is above the second (position ${error.position + 1})`;
      case 'unbalanced-parenthesis':
        return `A parenthesis has no pair (position ${error.position + 1})`;
      case 'quantifier-after-parenthesis':
        return `A repeat applies to one digit or «.», not to a parenthesis (position ${error.position + 1})`;
      case 'unexpected-character':
        return `Unexpected character (position ${error.position + 1})`;
      case 'dangling-escape':
        return '«\\» at the end escapes nothing';
      case 'too-long':
        return `A number has at most ${error.maximum} digits`;
      default:
        return assertNever(error);
    }
  },
  canonical: error => {
    switch (error.kind) {
      case 'national-prefix-mismatch':
        return `A national number here starts with ${error.nationalPrefix}; or write the mask with «+»`;
      case 'national-starts-with-wildcard':
        return `Start a national mask with ${error.nationalPrefix}, or write it with «+»`;
      default:
        return assertNever(error);
    }
  },
  startsWith: 'Starts with',
  contains: 'Contains',
  exactly: 'Exactly',
  anyDigit: '. any',
  anyRun: '* many',
  repeat: '{…}',
  repeatTitle: 'Repeat the symbol to the left',
  exactlyN: 'Exactly',
  fromTo: 'From – to',
  wholeStar: 'This mask takes every caller: every other group will conflict with it',
  matchingCalls: value =>
    plural('en', value, {
      one: 'matches # call in the journal',
      other: 'matches # calls in the journal',
    }),
};
