import { parseNumberMask } from './number-mask';
import { patternRegexSource } from './pattern-regex';

function matches(source: string, digits: string): boolean {
  const mask = parseNumberMask(source);
  if (!mask.ok) {
    throw new Error(`${source} did not parse`);
  }
  return new RegExp(patternRegexSource(mask.value.pattern, 'digits')).test(digits);
}

function errorKinds(source: string): readonly string[] {
  const mask = parseNumberMask(source);
  return mask.ok ? [] : mask.error.map(error => error.kind);
}

describe('a number mask', () => {
  it('covers the whole number: a prefix needs a star at the end', () => {
    expect(matches('+7 495*', '74951234567')).toBe(true);
    expect(matches('+7 495', '74951234567')).toBe(false);
    expect(matches('+7 495', '7495')).toBe(true);
  });

  it('reads the example from the request: 2 once or twice, any run, three any digits, then 5', () => {
    expect(matches('+7 921 2{1,2}*.{3}5', '792121235')).toBe(true);
    expect(matches('+7 921 2{1,2}*.{3}5', '79212212345')).toBe(true);
    expect(matches('+7 921 2{1,2}*.{3}5', '7921212345')).toBe(true);
    expect(matches('+7 921 2{1,2}*.{3}5', '79213123455')).toBe(false);
    expect(matches('+7 921 2{1,2}*.{3}5', '7921212346')).toBe(false);
  });

  it('treats spaces, dashes and parentheses as decoration only', () => {
    expect(matches('+31 (20) 555-12-34', '31205551234')).toBe(true);
  });

  it('knows a leading plus as the international form', () => {
    const mask = parseNumberMask('  +31 6*');
    expect(mask.ok && mask.value.international).toBe(true);
    const national = parseNumberMask('0800*');
    expect(national.ok && national.value.international).toBe(false);
  });

  it('accepts open and exact repetitions', () => {
    expect(matches('5{2,}', '555')).toBe(true);
    expect(matches('5{2,}', '5')).toBe(false);
    expect(matches('.{3}', '123')).toBe(true);
  });

  it('names every mistake with its position', () => {
    expect(parseNumberMask('7+1')).toEqual({
      ok: false,
      error: [{ kind: 'plus-not-first', position: 1 }],
    });
    expect(errorKinds('{2}5')).toEqual(['quantifier-without-symbol']);
    expect(errorKinds('5*{2}')).toEqual(['quantifier-after-star']);
    expect(errorKinds('(921){2}')).toEqual(['quantifier-after-parenthesis']);
    expect(errorKinds('5{3,2}')).toEqual(['quantifier-min-above-max']);
    expect(errorKinds('5{x}')).toEqual(['quantifier-malformed']);
    expect(errorKinds('(921')).toEqual(['unbalanced-parenthesis']);
    expect(errorKinds('921)')).toEqual(['unbalanced-parenthesis']);
    expect(errorKinds('92a1')).toEqual(['unexpected-character']);
    expect(errorKinds('   ')).toEqual(['empty']);
    expect(errorKinds('.{16}')).toEqual(['too-long']);
  });

  it('rejects a repetition stacked on a repetition', () => {
    expect(errorKinds('5{2}{3}')).toEqual(['quantifier-without-symbol']);
  });
});
