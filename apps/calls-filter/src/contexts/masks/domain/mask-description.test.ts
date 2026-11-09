import { describePattern, exampleOf } from './mask-description';
import { parseNumberMask } from './number-mask';
import { patternRegexSource } from './pattern-regex';

function pattern(source: string) {
  const mask = parseNumberMask(source);
  if (!mask.ok) {
    throw new Error(source);
  }
  return mask.value.pattern;
}

describe('a mask read aloud', () => {
  it('reads the example of the request piece by piece', () => {
    expect(describePattern(pattern('+7 921 2{1,2}*.{3}5'))).toEqual([
      { kind: 'text', text: '7921' },
      { kind: 'repeat', text: '2', min: 1, max: 2 },
      { kind: 'any', min: 0, max: null },
      { kind: 'any', min: 3, max: 3 },
      { kind: 'text', text: '5' },
    ]);
  });

  it('gives an example the mask really takes', () => {
    const mask = pattern('+7 921 2{1,2}*.{3}5');
    expect(new RegExp(patternRegexSource(mask, 'digits')).test(exampleOf(mask, '0'))).toBe(true);
  });
});
