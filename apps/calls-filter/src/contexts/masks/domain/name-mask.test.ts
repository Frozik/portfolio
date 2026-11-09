import { normalizeName } from '../../phone/domain/name-normalization';
import { parseNameMask } from './name-mask';
import { patternRegexSource } from './pattern-regex';

function matches(source: string, name: string): boolean {
  const mask = parseNameMask(source);
  if (!mask.ok) {
    throw new Error(`${source} did not parse`);
  }
  return new RegExp(patternRegexSource(mask.value.pattern, 'text'), 'u').test(normalizeName(name));
}

describe('a name mask', () => {
  it('finds a word anywhere with stars on both sides', () => {
    expect(matches('*доставка*', 'Служба ДОСТАВКА Ozon')).toBe(true);
    expect(matches('*доставка*', 'Курьер')).toBe(false);
  });

  it('ignores case, accents and doubled spaces in the mask and in the name', () => {
    expect(matches('Café  Été', 'CAFE ete')).toBe(true);
    expect(matches('*Ёлка*', 'новая елка')).toBe(true);
  });

  it('keeps «й» apart from «и»', () => {
    expect(matches('Йога', 'Иога')).toBe(false);
    expect(matches('Йога', 'ЙОГА')).toBe(true);
  });

  it('counts characters with the dot and repetitions', () => {
    expect(matches('Такси ......', 'Такси Москва')).toBe(true);
    expect(matches('Такси .{2,3}', 'Такси Москва')).toBe(false);
  });

  it('takes an escaped wildcard literally', () => {
    expect(matches('a\\.b', 'a.b')).toBe(true);
    expect(matches('a\\.b', 'axb')).toBe(false);
  });

  it('does not let edge spaces make a mask that never matches', () => {
    expect(matches('  курьер  ', 'Курьер')).toBe(true);
  });

  it('reports a dangling escape and an empty mask', () => {
    expect(parseNameMask('abc\\')).toEqual({
      ok: false,
      error: [{ kind: 'dangling-escape', position: 3 }],
    });
    expect(parseNameMask('   ')).toEqual({ ok: false, error: [{ kind: 'empty' }] });
  });
});

describe('name normalization', () => {
  it('folds the Turkish capital dotted I to a plain i', () => {
    expect(normalizeName('İstanbul')).toBe('istanbul');
  });

  it('turns compatibility forms into their plain letters', () => {
    expect(normalizeName('ﬁle')).toBe('file');
  });
});
