import { describe, expect, it } from 'vitest';

import { parseJson } from './parseJson';

describe('parseJson', () => {
  it('parses a JSON object into the typed value', () => {
    const result = parseJson<{ name: string; count: number }>('{"name":"alpha","count":3}');
    expect(result).toEqual({ name: 'alpha', count: 3 });
  });

  it('parses a JSON array', () => {
    const result = parseJson<number[]>('[1,2,3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('parses non-object JSON primitives', () => {
    expect(parseJson<number>('42')).toBe(42);
    expect(parseJson<boolean>('true')).toBe(true);
    expect(parseJson<string>('"text"')).toBe('text');
    expect(parseJson<null>('null')).toBeNull();
  });

  it('returns undefined for null input', () => {
    expect(parseJson(null)).toBeUndefined();
  });

  it('returns undefined for an empty string (invalid JSON)', () => {
    expect(parseJson('')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseJson('{not valid}')).toBeUndefined();
    expect(parseJson('{"unterminated":')).toBeUndefined();
    expect(parseJson('undefined')).toBeUndefined();
  });
});
