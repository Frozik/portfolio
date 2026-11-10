import { splitsWord } from './split-word';

const laidOut = (...lines: string[]) => lines.map(text => ({ text }));

describe('a label broken into lines', () => {
  it('splits no word when it fits on one line', () => {
    expect(splitsWord(laidOut('During events'))).toBe(false);
  });

  it('splits no word when it wraps at a space', () => {
    expect(splitsWord(laidOut('Вне ', 'событий'))).toBe(false);
  });

  it('splits no word when it wraps after a dash', () => {
    expect(splitsWord(laidOut('Mon–', 'Fri'))).toBe(false);
  });

  it('splits a word too wide for its line', () => {
    expect(splitsWord(laidOut('Блокиров', 'ать'))).toBe(true);
  });

  it('splits a word even when the line before it ended at a space', () => {
    expect(splitsWord(laidOut('Вне ', 'соб', 'ытий'))).toBe(true);
  });
});
