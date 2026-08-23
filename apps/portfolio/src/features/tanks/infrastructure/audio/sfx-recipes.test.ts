import { getPatchDurationSeconds, getRecipeDurationSeconds } from '@frozik/utils/audio/synth';
import { describe, expect, it } from 'vitest';
import type { SfxId } from './sfx-recipes';
import { SFX_PATCHES } from './sfx-recipes';

/** Everything §12.3 asks the synth to be able to say. */
const EXPECTED_SFX_IDS: readonly SfxId[] = [
  'shot',
  'brick-crumble',
  'steel-clang',
  'small-explosion',
  'big-explosion',
  'power-up-appear',
  'power-up-pickup',
  'extra-life',
  'pause-blip',
  'ice-skid',
  'score-tick',
];

/** Anything longer stops being a sound effect and starts covering the next one. */
const MAX_SFX_SECONDS = 1;
const MIN_AUDIBLE_HZ = 20;
const MAX_AUDIBLE_HZ = 20_000;

const sfxEntries = Object.entries(SFX_PATCHES);

describe('SFX_PATCHES', () => {
  it('covers the full sound inventory', () => {
    expect(Object.keys(SFX_PATCHES).sort()).toEqual([...EXPECTED_SFX_IDS].sort());
  });

  it.each(sfxEntries)('%s is made of at least one voice', (_sfxId, patch) => {
    expect(patch.length).toBeGreaterThan(0);
  });

  it.each(sfxEntries)('%s stays inside the mix', (_sfxId, patch) => {
    for (const { recipe } of patch) {
      expect(recipe.gain.peak).toBeGreaterThan(0);
      expect(recipe.gain.peak).toBeLessThanOrEqual(1);
    }
  });

  it.each(sfxEntries)('%s has a positive, bounded duration', (_sfxId, patch) => {
    for (const { recipe } of patch) {
      expect(recipe.gain.attackSeconds).toBeGreaterThan(0);
      expect(recipe.gain.decaySeconds).toBeGreaterThan(0);
      expect(getRecipeDurationSeconds(recipe)).toBeLessThanOrEqual(MAX_SFX_SECONDS);
    }

    expect(getPatchDurationSeconds(patch)).toBeGreaterThan(0);
    expect(getPatchDurationSeconds(patch)).toBeLessThanOrEqual(MAX_SFX_SECONDS);
  });

  it.each(sfxEntries)('%s stays audible at both ends of its glide', (_sfxId, patch) => {
    for (const { recipe } of patch) {
      const frequencies = [recipe.pitch.startHz, recipe.pitch.endHz ?? recipe.pitch.startHz];

      for (const frequencyHz of frequencies) {
        expect(frequencyHz).toBeGreaterThanOrEqual(MIN_AUDIBLE_HZ);
        expect(frequencyHz).toBeLessThanOrEqual(MAX_AUDIBLE_HZ);
      }
    }
  });

  it.each(sfxEntries)('%s never schedules a voice before the trigger', (_sfxId, patch) => {
    for (const { delaySeconds } of patch) {
      expect(delaySeconds ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the layered explosions more than one voice', () => {
    expect(SFX_PATCHES['big-explosion'].length).toBeGreaterThan(1);
    expect(SFX_PATCHES['small-explosion'].length).toBeGreaterThan(1);
  });

  it('rises through the pickup arpeggio', () => {
    const pitches = SFX_PATCHES['power-up-pickup'].map(layer => layer.recipe.pitch.startHz);

    expect(pitches).toEqual([...pitches].sort((left, right) => left - right));
  });
});
