import { assert } from '@frozik/utils/assert/assert';

/**
 * Equal-temperament note names and the arithmetic that turns them into frequencies. This lives
 * with the rest of the audio code rather than in `domain/`: a jingle's pitch is not a game rule,
 * it is a property of the sound the infrastructure synthesises (§12.3).
 */
const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type PitchClass = (typeof PITCH_CLASS_NAMES)[number];

/** The octaves our jingles are written in — deep enough for a bass line, high enough to sing. */
export type NoteOctave = 2 | 3 | 4 | 5 | 6;

export type NoteName = `${PitchClass}${NoteOctave}`;

/** Widened so a pitch class parsed back out of a `NoteName` can be located without a cast. */
const PITCH_CLASSES: readonly string[] = PITCH_CLASS_NAMES;

const SEMITONES_PER_OCTAVE = PITCH_CLASSES.length;
/** The tuning reference every other note is measured against. */
const REFERENCE_FREQUENCY_HZ = 440;
const REFERENCE_PITCH_CLASS: PitchClass = 'A';
const REFERENCE_OCTAVE = 4;
const OCTAVE_CHARACTER_COUNT = 1;
const DECIMAL_RADIX = 10;

function getReferenceSemitone(): number {
  return REFERENCE_OCTAVE * SEMITONES_PER_OCTAVE + PITCH_CLASSES.indexOf(REFERENCE_PITCH_CLASS);
}

/** `A4` → 440 Hz, one octave up doubles it — the standard 12-tone equal-temperament formula. */
export function getNoteFrequencyHz(note: NoteName): number {
  const pitchClassName = note.slice(0, note.length - OCTAVE_CHARACTER_COUNT);
  const octave = Number.parseInt(note.slice(note.length - OCTAVE_CHARACTER_COUNT), DECIMAL_RADIX);
  const pitchClassIndex = PITCH_CLASSES.indexOf(pitchClassName);

  assert(pitchClassIndex >= 0, `unknown pitch class in note "${note}"`);
  assert(Number.isInteger(octave), `unknown octave in note "${note}"`);

  const semitone = octave * SEMITONES_PER_OCTAVE + pitchClassIndex;

  return REFERENCE_FREQUENCY_HZ * 2 ** ((semitone - getReferenceSemitone()) / SEMITONES_PER_OCTAVE);
}
