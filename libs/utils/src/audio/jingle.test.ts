import { describe, expect, it } from 'vitest';

import type { IJingle } from './jingle';
import { toJingleSoundPatch } from './jingle';
import { getNoteFrequencyHz } from './noteFrequency';
import { getPatchDurationSeconds } from './synth';

const TICKS_PER_SECOND = 60;
const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
const QUARTER_NOTE_TICKS = 15;
const HALF_NOTE_TICKS = QUARTER_NOTE_TICKS * 2;
const PEAK_GAIN = 0.16;

const MELODY: IJingle = {
  waveform: 'square',
  peakGain: PEAK_GAIN,
  notes: [
    { note: 'C4', durationTicks: QUARTER_NOTE_TICKS },
    { note: 'C4', durationTicks: QUARTER_NOTE_TICKS },
    { note: 'G4', durationTicks: HALF_NOTE_TICKS },
  ],
};

describe('toJingleSoundPatch', () => {
  it('renders one voice per note, in order', () => {
    const patch = toJingleSoundPatch(MELODY, SECONDS_PER_TICK);

    expect(patch).toHaveLength(MELODY.notes.length);
    expect(patch.map(layer => layer.recipe.pitch.startHz)).toEqual([
      getNoteFrequencyHz('C4'),
      getNoteFrequencyHz('C4'),
      getNoteFrequencyHz('G4'),
    ]);
  });

  it('starts each note where the previous one ended', () => {
    const patch = toJingleSoundPatch(MELODY, SECONDS_PER_TICK);

    expect(patch.map(layer => layer.delaySeconds)).toEqual([
      0,
      QUARTER_NOTE_TICKS * SECONDS_PER_TICK,
      HALF_NOTE_TICKS * SECONDS_PER_TICK,
    ]);
  });

  it('leaves a gap between notes so a repeated pitch is still two notes', () => {
    const patch = toJingleSoundPatch(MELODY, SECONDS_PER_TICK);

    patch.forEach((layer, index) => {
      const nextLayer = patch[index + 1];

      if (nextLayer === undefined) {
        return;
      }

      const endSeconds =
        (layer.delaySeconds ?? 0) +
        layer.recipe.gain.attackSeconds +
        layer.recipe.gain.decaySeconds;

      expect(endSeconds).toBeLessThan(nextLayer.delaySeconds ?? 0);
    });
  });

  it('scales the whole melody with the caller tick rate', () => {
    const slowSeconds = getPatchDurationSeconds(toJingleSoundPatch(MELODY, SECONDS_PER_TICK * 2));
    const fastSeconds = getPatchDurationSeconds(toJingleSoundPatch(MELODY, SECONDS_PER_TICK));

    expect(slowSeconds).toBeGreaterThan(fastSeconds);
  });

  it('keeps the gain envelope inside the note it belongs to', () => {
    for (const layer of toJingleSoundPatch(MELODY, SECONDS_PER_TICK)) {
      expect(layer.recipe.gain.peak).toBe(MELODY.peakGain);
      expect(layer.recipe.gain.decaySeconds).toBeGreaterThan(0);
    }
  });
});
