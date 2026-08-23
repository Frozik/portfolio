import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import { getPatchDurationSeconds } from '@frozik/utils/audio/synth';
import { describe, expect, it } from 'vitest';
import type { JingleId } from './jingles';
import { JINGLES, toJinglePatch } from './jingles';

const EXPECTED_JINGLE_IDS: readonly JingleId[] = ['stage-start', 'game-over'];
/** A jingle that outlasts the two-second curtain would still be playing during the round. */
const MAX_JINGLE_SECONDS = 2.5;

const jingleEntries = Object.entries(JINGLES);

describe('JINGLES', () => {
  it('ships exactly the two melodies the flow needs', () => {
    expect(Object.keys(JINGLES).sort()).toEqual([...EXPECTED_JINGLE_IDS].sort());
  });

  it.each(jingleEntries)('%s is a playable melody', (_jingleId, jingle) => {
    expect(jingle.notes.length).toBeGreaterThan(0);
    expect(jingle.peakGain).toBeGreaterThan(0);
    expect(jingle.peakGain).toBeLessThanOrEqual(1);

    for (const { note, durationTicks } of jingle.notes) {
      expect(durationTicks).toBeGreaterThan(0);
      expect(Number.isInteger(durationTicks)).toBe(true);
      expect(getNoteFrequencyHz(note)).toBeGreaterThan(0);
    }
  });

  it.each(jingleEntries)('%s fits inside its overlay', (_jingleId, jingle) => {
    expect(getPatchDurationSeconds(toJinglePatch(jingle))).toBeLessThanOrEqual(MAX_JINGLE_SECONDS);
  });

  it('lays the notes out one after another', () => {
    const patch = toJinglePatch(JINGLES['stage-start']);
    const delays = patch.map(layer => layer.delaySeconds ?? 0);

    expect(delays[0]).toBe(0);
    expect(delays).toEqual([...delays].sort((left, right) => left - right));
    expect(new Set(delays).size).toBe(delays.length);
  });

  it('leaves a gap between notes so a repeated pitch is still two notes', () => {
    const patch = toJinglePatch(JINGLES['stage-start']);

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

  it('descends through the game-over motif', () => {
    const pitches = toJinglePatch(JINGLES['game-over']).map(layer => layer.recipe.pitch.startHz);

    expect(pitches).toEqual([...pitches].sort((left, right) => right - left));
  });
});
