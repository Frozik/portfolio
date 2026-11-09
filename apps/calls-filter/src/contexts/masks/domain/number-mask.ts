import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { Brand } from '@frozik/utils/types/base';

import type { TMaskError } from './mask-error';
import type { IPatternElement, TPattern } from './pattern';
import { minimumLength } from './pattern';
import { readQuantifier, skipPastBrace } from './quantifier';

/** E.164 allows at most fifteen digits after the plus. */
export const MAX_NUMBER_DIGITS = 15;

interface INumberMaskShape {
  readonly source: string;
  /** Written with a leading `+`: matched against the international (E.164) digits. */
  readonly international: boolean;
  readonly pattern: TPattern;
}

/** A number mask that parsed: only `parseNumberMask` makes one. */
export type NumberMask = Brand<INumberMaskShape, 'NumberMask'>;

type TPrevious = 'nothing' | 'symbol' | 'quantified' | 'star' | 'parenthesis';

const ANY_DIGIT: IPatternElement = { symbol: { kind: 'any' }, min: 1, max: 1 };
const ANY_RUN: IPatternElement = { symbol: { kind: 'any' }, min: 0, max: null };
const SEPARATORS = new Set([' ', '-']);
const DIGIT = /^\d$/;

function quantifierError(previous: TPrevious, position: number): TMaskError {
  switch (previous) {
    case 'star':
      return { kind: 'quantifier-after-star', position };
    case 'parenthesis':
      return { kind: 'quantifier-after-parenthesis', position };
    case 'nothing':
    case 'quantified':
    case 'symbol':
      return { kind: 'quantifier-without-symbol', position };
  }
}

export function parseNumberMask(source: string): TResult<NumberMask, readonly TMaskError[]> {
  const elements: IPatternElement[] = [];
  const errors: TMaskError[] = [];
  const openParentheses: number[] = [];
  const firstSignificant = source.search(/\S/);
  let international = false;
  let previous: TPrevious = 'nothing';
  let index = 0;

  while (index < source.length) {
    const character = source[index] ?? '';
    if (SEPARATORS.has(character)) {
      previous = 'nothing';
      index += 1;
      continue;
    }
    if (character === '(') {
      openParentheses.push(index);
      previous = 'nothing';
    } else if (character === ')') {
      if (openParentheses.pop() === undefined) {
        errors.push({ kind: 'unbalanced-parenthesis', position: index });
      }
      previous = 'parenthesis';
    } else if (character === '+') {
      if (index === firstSignificant) {
        international = true;
      } else {
        errors.push({ kind: 'plus-not-first', position: index });
      }
      previous = 'nothing';
    } else if (DIGIT.test(character)) {
      elements.push({ symbol: { kind: 'literal', value: character }, min: 1, max: 1 });
      previous = 'symbol';
    } else if (character === '.') {
      elements.push(ANY_DIGIT);
      previous = 'symbol';
    } else if (character === '*') {
      elements.push(ANY_RUN);
      previous = 'star';
    } else if (character === '{') {
      const quantifier = readQuantifier(source, index);
      if (!quantifier.ok) {
        errors.push(quantifier.error);
        index = skipPastBrace(source, index);
        continue;
      }
      const last = elements.at(-1);
      if (previous !== 'symbol' || last === undefined) {
        errors.push(quantifierError(previous, index));
      } else {
        elements[elements.length - 1] = {
          ...last,
          min: quantifier.value.min,
          max: quantifier.value.max,
        };
        previous = 'quantified';
      }
      index = quantifier.value.next;
      continue;
    } else {
      errors.push({ kind: 'unexpected-character', position: index });
    }
    index += 1;
  }

  for (const position of openParentheses) {
    errors.push({ kind: 'unbalanced-parenthesis', position });
  }
  if (elements.length === 0 && errors.length === 0) {
    errors.push({ kind: 'empty' });
  }
  if (minimumLength(elements) > MAX_NUMBER_DIGITS) {
    errors.push({ kind: 'too-long', maximum: MAX_NUMBER_DIGITS });
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok({ source, international, pattern: elements } as INumberMaskShape as NumberMask);
}
