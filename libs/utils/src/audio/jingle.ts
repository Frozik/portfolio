import type { NoteName } from '@frozik/utils/audio/noteFrequency';
import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch, SynthWaveform } from '@frozik/utils/audio/synth';

/**
 * Melodies authored as note arrays rather than shipped as audio. Only two melodic sources are
 * allowed: our own compositions and the public domain — a transcription of a copyrighted tune
 * stays copyrighted whoever types the notes in.
 */
export interface IJingleNote {
  readonly note: NoteName;
  /** In the caller's own tick unit, converted through the `secondsPerTick` of its game loop. */
  readonly durationTicks: number;
}

export interface IJingle {
  readonly waveform: SynthWaveform;
  readonly peakGain: number;
  readonly notes: readonly IJingleNote[];
}

/** Notes stop a hair before the next one starts, so repeated pitches stay countable. */
const NOTE_GAP_SECONDS = 0.02;
const NOTE_ATTACK_SECONDS = 0.008;

/** Lays a melody out on the timeline: one voice per note, each starting where the last ended. */
export function toJingleSoundPatch(jingle: IJingle, secondsPerTick: number): SoundPatch {
  let elapsedSeconds = 0;

  return jingle.notes.map(({ note, durationTicks }) => {
    const delaySeconds = elapsedSeconds;
    const noteSeconds = durationTicks * secondsPerTick;

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
