import { describe, expect, it } from 'vitest';

import { getNoteFrequencyHz } from './noteFrequency';

describe('getNoteFrequencyHz', () => {
  it('pins the tuning reference at 440 Hz', () => {
    expect(getNoteFrequencyHz('A4')).toBe(440);
  });

  it('doubles every octave', () => {
    expect(getNoteFrequencyHz('A5')).toBeCloseTo(880);
    expect(getNoteFrequencyHz('A3')).toBeCloseTo(220);
  });

  it('places middle C where equal temperament puts it', () => {
    expect(getNoteFrequencyHz('C4')).toBeCloseTo(261.63, 2);
  });

  it('reads accidentals as the semitone above the natural', () => {
    expect(getNoteFrequencyHz('G#3')).toBeCloseTo(207.65, 2);
    expect(getNoteFrequencyHz('G#3')).toBeGreaterThan(getNoteFrequencyHz('G3'));
  });

  it('keeps the twelve semitones of an octave in ascending order', () => {
    const octave = [
      getNoteFrequencyHz('C4'),
      getNoteFrequencyHz('C#4'),
      getNoteFrequencyHz('D4'),
      getNoteFrequencyHz('D#4'),
      getNoteFrequencyHz('E4'),
      getNoteFrequencyHz('F4'),
      getNoteFrequencyHz('F#4'),
      getNoteFrequencyHz('G4'),
      getNoteFrequencyHz('G#4'),
      getNoteFrequencyHz('A4'),
      getNoteFrequencyHz('A#4'),
      getNoteFrequencyHz('B4'),
    ];

    expect(octave).toEqual([...octave].sort((left, right) => left - right));
    expect(getNoteFrequencyHz('C5')).toBeCloseTo(octave[0] * 2, 5);
  });
});
