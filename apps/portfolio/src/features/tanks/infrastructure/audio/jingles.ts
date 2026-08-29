import type { IJingle, IJingleNote } from '@frozik/utils/audio/jingle';
import { toJingleSoundPatch } from '@frozik/utils/audio/jingle';
import type { NoteName } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch } from '@frozik/utils/audio/synth';
import { TICKS_PER_SECOND } from '../../domain/constants';

export type JingleId = 'stage-start' | 'game-over';

const QUARTER_NOTE_TICKS = 14;
const HALF_NOTE_TICKS = QUARTER_NOTE_TICKS * 2;
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
  return toJingleSoundPatch(jingle, SECONDS_PER_TICK);
}
