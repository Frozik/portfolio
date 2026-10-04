import type { Result } from '../Result';
import { err, ok } from '../Result';
import type { ExpressionError } from './expression-error';
import { CONSTANTS, FUNCTIONS, VARIABLE } from './vocabulary';

export type Operator = '+' | '-' | '*' | '/' | '^';

export type Token =
  | { readonly kind: 'number'; readonly value: number; readonly position: number }
  | { readonly kind: 'identifier'; readonly name: string; readonly position: number }
  | { readonly kind: 'operator'; readonly operator: Operator; readonly position: number }
  | { readonly kind: 'open'; readonly position: number }
  | { readonly kind: 'close'; readonly position: number }
  | { readonly kind: 'end'; readonly position: number };

const NUMBER = /\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.(?![\d])/y;
const LETTERS = /[a-zA-Z]+/y;
/** Longest first, so `sinh` wins over `sin` and `exp` over `e`. */
const KNOWN_WORDS: readonly string[] = [VARIABLE, ...CONSTANTS.keys(), ...FUNCTIONS.keys()].sort(
  (left, right) => right.length - left.length
);
const WHITESPACE = /\s+/y;
const OPERATORS: ReadonlyMap<string, Operator> = new Map([
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['/', '/'],
  ['^', '^'],
]);
const PARENTHESES: ReadonlyMap<string, 'open' | 'close'> = new Map([
  ['(', 'open'],
  [')', 'close'],
]);

/**
 * `**` is accepted as a synonym of `^`; `2e` is two times e, `2e3` is two
 * thousand. Letters run together split into known words — `xsin(x)` is
 * `x·sin(x)`, `2pix` is `2·pi·x` — and an unknown name is reported where it starts.
 */
export function tokenize(source: string): Result<readonly Token[], ExpressionError> {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    const scanned = scan(source, position);
    if (!scanned.ok) {
      return scanned;
    }
    if (scanned.value.token !== undefined) {
      tokens.push(scanned.value.token);
    }
    position = scanned.value.next;
  }
  tokens.push({ kind: 'end', position: source.length });
  return ok(tokens);
}

function scan(
  source: string,
  position: number
): Result<{ readonly token: Token | undefined; readonly next: number }, ExpressionError> {
  const whitespace = matchAt(WHITESPACE, source, position);
  if (whitespace !== undefined) {
    return ok({ token: undefined, next: position + whitespace.length });
  }
  if (source.startsWith('**', position)) {
    return ok({ token: { kind: 'operator', operator: '^', position }, next: position + 2 });
  }
  const number = matchAt(NUMBER, source, position);
  if (number !== undefined) {
    const value = Number(number);
    if (!Number.isFinite(value)) {
      return err({ position, reason: 'invalid-number' });
    }
    return ok({ token: { kind: 'number', value, position }, next: position + number.length });
  }
  const letters = matchAt(LETTERS, source, position)?.toLowerCase();
  if (letters !== undefined) {
    const word = KNOWN_WORDS.find(known => letters.startsWith(known));
    if (word === undefined) {
      return err({ position, reason: 'unknown-identifier' });
    }
    return ok({
      token: { kind: 'identifier', name: word, position },
      next: position + word.length,
    });
  }
  const character = source.charAt(position);
  const operator = OPERATORS.get(character);
  if (operator !== undefined) {
    return ok({ token: { kind: 'operator', operator, position }, next: position + 1 });
  }
  const parenthesis = PARENTHESES.get(character);
  if (parenthesis !== undefined) {
    return ok({ token: { kind: parenthesis, position }, next: position + 1 });
  }
  return err({ position, reason: 'unexpected-character' });
}

function matchAt(pattern: RegExp, source: string, position: number): string | undefined {
  pattern.lastIndex = position;
  return pattern.exec(source)?.[0];
}
