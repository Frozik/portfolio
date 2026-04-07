import { assertNever } from './assertNever';

describe('assertNever', () => {
  it('throws on a string value', () => {
    expect(() => assertNever('unexpected' as never)).toThrow(
      'assertNever invocation for "unexpected" type of string'
    );
  });

  it('throws on a number value', () => {
    expect(() => assertNever(42 as never)).toThrow(
      'assertNever invocation for "42" type of number'
    );
  });

  it('throws on null', () => {
    expect(() => assertNever(null as never)).toThrow(
      'assertNever invocation for "null" type of object'
    );
  });
});
