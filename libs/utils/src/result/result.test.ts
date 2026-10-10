import type { TResult } from './result';
import { err, ok } from './result';

type TParseError =
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-a-number'; readonly input: string };

function parseCount(input: string): TResult<number, TParseError> {
  if (input === '') {
    return err({ kind: 'empty' });
  }
  const count = Number(input);
  return Number.isNaN(count) ? err({ kind: 'not-a-number', input }) : ok(count);
}

describe('TResult', () => {
  it('carries the value of a success', () => {
    expect(parseCount('42')).toEqual({ ok: true, value: 42 });
  });

  it('carries the discriminated error of a failure', () => {
    expect(parseCount('')).toEqual({ ok: false, error: { kind: 'empty' } });
    expect(parseCount('x')).toEqual({ ok: false, error: { kind: 'not-a-number', input: 'x' } });
  });

  it('narrows to the value or the error by `ok`', () => {
    const result = parseCount('7');

    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<number>();
    } else {
      expectTypeOf(result.error).toEqualTypeOf<TParseError>();
    }
  });

  it('lets a success and a failure flow into any result of matching sides', () => {
    expectTypeOf(ok(1)).toExtend<TResult<number, TParseError>>();
    expectTypeOf(err({ kind: 'empty' as const })).toExtend<TResult<number, TParseError>>();
    expectTypeOf(ok('text')).not.toExtend<TResult<number, TParseError>>();
  });
});
