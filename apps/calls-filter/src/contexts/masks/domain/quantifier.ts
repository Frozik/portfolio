import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TMaskError } from './mask-error';

export interface IQuantifier {
  readonly min: number;
  readonly max: number | null;
  /** The index right after the closing brace. */
  readonly next: number;
}

const DIGITS = /^\d+/;

/** Reads `{n}`, `{n,m}` or `{n,}` starting at the opening brace at `start`. */
export function readQuantifier(source: string, start: number): TResult<IQuantifier, TMaskError> {
  const rest = source.slice(start + 1);
  const minText = DIGITS.exec(rest)?.[0];
  if (minText === undefined) {
    return err({ kind: 'quantifier-malformed', position: start });
  }
  const min = Number(minText);
  let cursor = start + 1 + minText.length;
  if (source[cursor] === '}') {
    return ok({ min, max: min, next: cursor + 1 });
  }
  if (source[cursor] !== ',') {
    return err({ kind: 'quantifier-malformed', position: start });
  }
  cursor += 1;
  const maxText = DIGITS.exec(source.slice(cursor))?.[0];
  cursor += maxText?.length ?? 0;
  if (source[cursor] !== '}') {
    return err({ kind: 'quantifier-malformed', position: start });
  }
  const max = maxText === undefined ? null : Number(maxText);
  if (max !== null && min > max) {
    return err({ kind: 'quantifier-min-above-max', position: start });
  }
  return ok({ min, max, next: cursor + 1 });
}

/** Where reading resumes after a malformed quantifier: past its closing brace, or the next character. */
export function skipPastBrace(source: string, start: number): number {
  const closing = source.indexOf('}', start);
  return closing === -1 ? start + 1 : closing + 1;
}
