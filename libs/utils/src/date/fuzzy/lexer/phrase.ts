import { isNil } from 'lodash-es';

import type { ETokenKind, Meaning, Token, TokenOf } from './token';

type Guard<Matched extends Token> = (token: Token) => token is Matched;

export interface IPhrase {
  /** Words the phrase reads — and no phrase above it does. */
  readonly example: string;
  readonly length: number;
  readonly read: (tokens: readonly Token[]) => readonly Meaning[] | undefined;
}

export function ofKind<Wanted extends ETokenKind>(kind: Wanted): Guard<TokenOf<Wanted>> {
  return (token): token is TokenOf<Wanted> => token.kind === kind;
}

/** Any of the words as written, whatever the vocabulary takes them for: the "day" of "day after tomorrow" is no unit. */
export function word(...expected: readonly string[]): Guard<Token> {
  return (token): token is Token => expected.includes(token.text.toLowerCase());
}

/** A phrase reads exactly as many tokens as it has guards: no fewer at the end of the input, no more. */
function isWhole(tokens: readonly (Token | undefined)[], rest: readonly Token[]): boolean {
  return rest.length === 0 && tokens.every(token => !isNil(token));
}

export function phraseOfTwo<First extends Token, Second extends Token>(
  example: string,
  guards: readonly [Guard<First>, Guard<Second>],
  read: (first: First, second: Second) => readonly Meaning[] | undefined
): IPhrase {
  return {
    example,
    length: guards.length,
    read: ([first, second, ...rest]) =>
      isWhole([first, second], rest) && guards[0](first) && guards[1](second)
        ? read(first, second)
        : undefined,
  };
}

export function phraseOfThree<First extends Token, Second extends Token, Third extends Token>(
  example: string,
  guards: readonly [Guard<First>, Guard<Second>, Guard<Third>],
  read: (first: First, second: Second, third: Third) => readonly Meaning[] | undefined
): IPhrase {
  return {
    example,
    length: guards.length,
    read: ([first, second, third, ...rest]) =>
      isWhole([first, second, third], rest) &&
      guards[0](first) &&
      guards[1](second) &&
      guards[2](third)
        ? read(first, second, third)
        : undefined,
  };
}

export function phraseOfFour<
  First extends Token,
  Second extends Token,
  Third extends Token,
  Fourth extends Token,
>(
  example: string,
  guards: readonly [Guard<First>, Guard<Second>, Guard<Third>, Guard<Fourth>],
  read: (
    first: First,
    second: Second,
    third: Third,
    fourth: Fourth
  ) => readonly Meaning[] | undefined
): IPhrase {
  return {
    example,
    length: guards.length,
    read: ([first, second, third, fourth, ...rest]) =>
      isWhole([first, second, third, fourth], rest) &&
      guards[0](first) &&
      guards[1](second) &&
      guards[2](third) &&
      guards[3](fourth)
        ? read(first, second, third, fourth)
        : undefined,
  };
}
