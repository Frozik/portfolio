import type { NoteName } from '@frozik/utils/audio/noteFrequency';
import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch, SynthWaveform } from '@frozik/utils/audio/synth';

import { TICKS_PER_SECOND } from '../../domain/constants';

/**
 * Hand-authored melodies, written as note arrays rather than shipped as audio (§12.2). Only two
 * melodic sources are allowed: our own compositions and the public domain. Transcribing the
 * original's tunes is never acceptable — the composition stays copyrighted whoever types it in.
 */
export interface IScorchedJingleNote {
  readonly note: NoteName;
  readonly durationTicks: number;
}

export interface IScorchedJingle {
  readonly waveform: SynthWaveform;
  readonly peakGain: number;
  readonly notes: readonly IScorchedJingleNote[];
}

export type ScorchedJingleId = 'round-start' | 'round-won' | 'match-won';

const QUARTER_NOTE_TICKS = 13;
const HALF_NOTE_TICKS = QUARTER_NOTE_TICKS * 2;
/** Three to the beat, for the pickup the round fanfare opens on. */
const TRIPLET_NOTE_TICKS = Math.round(QUARTER_NOTE_TICKS / 3);
/** Notes stop a hair before the next one starts, so repeated pitches stay countable. */
const NOTE_GAP_SECONDS = 0.02;
const NOTE_ATTACK_SECONDS = 0.008;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;

function quarter(note: NoteName): IScorchedJingleNote {
  return { note, durationTicks: QUARTER_NOTE_TICKS };
}

export const SCORCHED_JINGLES: Readonly<Record<ScorchedJingleId, IScorchedJingle>> = {
  /** Our own motif: a rising bugle-shaped call on the notes of a major triad. */
  'round-start': {
    waveform: 'square',
    peakGain: 0.15,
    notes: [
      quarter('C4'),
      quarter('E4'),
      quarter('G4'),
      { note: 'C5', durationTicks: HALF_NOTE_TICKS },
    ],
  },

  /**
   * Our own motif, and deliberately not the round-start call again an octave up: that one is a
   * bugle asking a question, this one answers it. A triplet pickup on the dominant, then a held
   * sixth resolving to the tonic, on a triangle so the timbre alone tells the two apart even
   * before the melody does — the player never has to wonder which end of a round they are at.
   */
  'round-won': {
    waveform: 'triangle',
    peakGain: 0.17,
    notes: [
      { note: 'G4', durationTicks: TRIPLET_NOTE_TICKS },
      { note: 'G4', durationTicks: TRIPLET_NOTE_TICKS },
      { note: 'G4', durationTicks: TRIPLET_NOTE_TICKS },
      { note: 'A5', durationTicks: HALF_NOTE_TICKS },
      { note: 'G5', durationTicks: QUARTER_NOTE_TICKS },
      { note: 'C6', durationTicks: HALF_NOTE_TICKS * 2 },
    ],
  },

  /** Our own motif: a wider, slower version of the round fanfare for the end of the match. */
  'match-won': {
    waveform: 'triangle',
    peakGain: 0.2,
    notes: [
      { note: 'C4', durationTicks: HALF_NOTE_TICKS },
      quarter('G4'),
      quarter('E4'),
      { note: 'C5', durationTicks: HALF_NOTE_TICKS },
      { note: 'G5', durationTicks: HALF_NOTE_TICKS * 2 },
    ],
  },
};

/** Lays a melody out on the timeline: one voice per note, each starting where the last ended. */
export function toScorchedJinglePatch(jingle: IScorchedJingle): SoundPatch {
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
