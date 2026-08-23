import type { NoteName } from '@frozik/utils/audio/noteFrequency';
import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch, SynthWaveform } from '@frozik/utils/audio/synth';
import { TICKS_PER_SECOND } from '../../domain/constants';

/**
 * Melodies may come from two sources only: our own compositions and the public domain (§12.3).
 * Transcriptions of the original game's tunes stay copyrighted no matter who typed the notes in.
 */
export interface IJingleNote {
  readonly note: NoteName;
  readonly durationTicks: number;
}

export interface IJingle {
  readonly waveform: SynthWaveform;
  readonly peakGain: number;
  readonly notes: readonly IJingleNote[];
}

export type JingleId = 'stage-start' | 'game-over';

const QUARTER_NOTE_TICKS = 14;
const HALF_NOTE_TICKS = QUARTER_NOTE_TICKS * 2;
/** Notes stop a hair before the next one starts, so repeated pitches stay countable. */
const NOTE_GAP_SECONDS = 0.02;
const NOTE_ATTACK_SECONDS = 0.008;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;

function quarter(note: NoteName): IJingleNote {
  return { note, durationTicks: QUARTER_NOTE_TICKS };
}

export const JINGLES: Readonly<Record<JingleId, IJingle>> = {
  /** The opening phrase of Beethoven's "Ode to Joy" (1824, public domain). */
  'stage-start': {
    waveform: 'square',
    peakGain: 0.16,
    notes: [
      quarter('E5'),
      quarter('E5'),
      quarter('F5'),
      quarter('G5'),
      quarter('G5'),
      quarter('F5'),
      quarter('E5'),
      { note: 'D5', durationTicks: HALF_NOTE_TICKS },
    ],
  },

  /** Our own motif: a chromatic slide down to the tonic. */
  'game-over': {
    waveform: 'triangle',
    peakGain: 0.2,
    notes: [
      { note: 'A3', durationTicks: HALF_NOTE_TICKS },
      quarter('G#3'),
      quarter('G3'),
      { note: 'F3', durationTicks: HALF_NOTE_TICKS },
      { note: 'D3', durationTicks: HALF_NOTE_TICKS * 2 },
    ],
  },
};

export function toJinglePatch(jingle: IJingle): SoundPatch {
  let elapsedSeconds = 0;

  return jingle.notes.map(({ note, durationTicks }) => {
    const delaySeconds = elapsedSeconds;
    const noteSeconds = durationTicks * SECONDS_PER_TICK;

    elapsedSeconds += noteSeconds;

    return {
      delaySeconds,
      recipe: {
        waveform: jingle.waveform,
        pitch: { startHz: getNoteFrequencyHz(note) },
        gain: {
          peak: jingle.peakGain,
          attackSeconds: NOTE_ATTACK_SECONDS,
          decaySeconds: Math.max(
            noteSeconds - NOTE_ATTACK_SECONDS - NOTE_GAP_SECONDS,
            NOTE_GAP_SECONDS
          ),
        },
      },
    };
  });
}
