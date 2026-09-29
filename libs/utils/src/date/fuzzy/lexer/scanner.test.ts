import { describe, expect, it } from 'vitest';

import { ESeparator } from './lexeme';
import { scan } from './scanner';

function texts(input: string): readonly string[] {
  return scan(input).map(lexeme => lexeme.text);
}

function joints(input: string): readonly (ESeparator | undefined)[] {
  return scan(input).map(lexeme => lexeme.joint);
}

describe('scan', () => {
  it('cuts the text at spaces and commas', () => {
    expect(texts('jan 15, 2025')).toEqual(['jan', '15', '2025']);
    expect(texts('  tom \t 13:00 ')).toEqual(['tom', '13:00']);
  });

  it('keeps a clock time in one lexeme, fraction and am/pm included', () => {
    expect(texts('9:30:45.123')).toEqual(['9:30:45.123']);
    expect(texts('5:30pm')).toEqual(['5:30pm']);
  });

  it.each([
    ['15/03/2024', ESeparator.Slash],
    ['15.03.2024', ESeparator.Dot],
    ['15-03-2024', ESeparator.Dash],
  ])('cuts "%s" at the date separator and remembers it as the joint', (input, separator) => {
    expect(texts(input)).toEqual(['15', '03', '2024']);
    expect(joints(input)).toEqual([undefined, separator, separator]);
  });

  it('remembers a separator written with spaces around it', () => {
    expect(texts('15 / 03')).toEqual(['15', '03']);
    expect(joints('15 / 03')).toEqual([undefined, ESeparator.Slash]);
  });

  it('reads a sign as the start of an offset', () => {
    expect(texts('+3d -1w')).toEqual(['+3d', '-1w']);
  });

  it('reads a dash that stands alone as a separator', () => {
    expect(texts('15 - 03')).toEqual(['15', '03']);
    expect(joints('15 - 03')).toEqual([undefined, ESeparator.Dash]);
  });

  it('cuts a hyphenated phrase into its words', () => {
    expect(texts('end-of-month')).toEqual(['end', 'of', 'month']);
  });

  it('keeps digits and letters written together in one lexeme', () => {
    expect(texts("10nov nov10 15th 9am 1q'25 '27")).toEqual([
      '10nov',
      'nov10',
      '15th',
      '9am',
      "1q'25",
      "'27",
    ]);
  });

  it('gives nothing for blank text', () => {
    expect(scan('  ')).toEqual([]);
  });
});
