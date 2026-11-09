import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { Brand } from '@frozik/utils/types/base';

import { normalizeName } from '../../phone/domain/name-normalization';

import type { TMaskError } from './mask-error';
import type { IPatternElement, TPattern } from './pattern';
import { readQuantifier, skipPastBrace } from './quantifier';

interface INameMaskShape {
  readonly source: string;
  readonly pattern: TPattern;
}

/** A name mask that parsed: only `parseNameMask` makes one. Its literals are already normalized. */
export type NameMask = Brand<INameMaskShape, 'NameMask'>;

type TPrevious = 'nothing' | 'symbol' | 'quantified' | 'star';

const ANY_CHARACTER: IPatternElement = { symbol: { kind: 'any' }, min: 1, max: 1 };
const ANY_RUN: IPatternElement = { symbol: { kind: 'any' }, min: 0, max: null };
const SPACE = ' ';

function pushLiteral(elements: IPatternElement[], character: string): boolean {
  const normalized = /\s/.test(character) ? SPACE : normalizeName(character);
  let pushed = false;
  for (const value of normalized) {
    const last = elements.at(-1);
    const isRepeatedSpace =
      value === SPACE &&
      (last === undefined || (last.symbol.kind === 'literal' && last.symbol.value === SPACE));
    if (!isRepeatedSpace) {
      elements.push({ symbol: { kind: 'literal', value }, min: 1, max: 1 });
      pushed = true;
    }
  }
  return pushed;
}

export function parseNameMask(source: string): TResult<NameMask, readonly TMaskError[]> {
  const elements: IPatternElement[] = [];
  const errors: TMaskError[] = [];
  let previous: TPrevious = 'nothing';
  let index = 0;

  while (index < source.length) {
    const character = source[index] ?? '';
    if (character === '\\') {
      const escaped = source[index + 1];
      if (escaped === undefined) {
        errors.push({ kind: 'dangling-escape', position: index });
        index += 1;
        continue;
      }
      previous = pushLiteral(elements, escaped) ? 'symbol' : 'nothing';
      index += 2;
      continue;
    }
    if (character === '.') {
      elements.push(ANY_CHARACTER);
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
        errors.push(
          previous === 'star'
            ? { kind: 'quantifier-after-star', position: index }
            : { kind: 'quantifier-without-symbol', position: index }
        );
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
      previous = pushLiteral(elements, character) ? 'symbol' : previous;
    }
    index += 1;
  }

  const trimmed = trimSpaces(elements);
  if (trimmed.length === 0 && errors.length === 0) {
    errors.push({ kind: 'empty' });
  }
  if (errors.length > 0) {
    return err(errors);
  }
  return ok({ source, pattern: trimmed } as INameMaskShape as NameMask);
}

function isSpace(element: IPatternElement | undefined): boolean {
  return element?.symbol.kind === 'literal' && element.symbol.value === SPACE;
}

/** A normalized name never starts or ends with a space, so a mask's edge spaces could never match. */
function trimSpaces(elements: readonly IPatternElement[]): TPattern {
  let from = 0;
  let to = elements.length;
  while (from < to && isSpace(elements[from])) {
    from += 1;
  }
  while (to > from && isSpace(elements[to - 1])) {
    to -= 1;
  }
  return elements.slice(from, to);
}
