import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch } from '@frozik/utils/audio/synth';

export type SfxId =
  | 'shot'
  | 'brick-crumble'
  | 'steel-clang'
  | 'small-explosion'
  | 'big-explosion'
  | 'power-up-appear'
  | 'power-up-pickup'
  | 'extra-life'
  | 'pause-blip'
  | 'ice-skid'
  | 'score-tick';

/** A pickup arpeggio's notes land this far apart — fast enough to read as one gesture. */
const ARPEGGIO_STEP_SECONDS = 0.055;
const FANFARE_STEP_SECONDS = 0.09;

export const SFX_PATCHES: Readonly<Record<SfxId, SoundPatch>> = {
  /** A tight downward chirp: the barrel's crack, not a laser. */
  shot: [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: 900, endHz: 180, slide: 'exponential' },
        gain: { peak: 0.2, attackSeconds: 0.002, decaySeconds: 0.07 },
      },
    },
  ],

  /** Dry rubble: noise with the top rolled off as the dust settles. */
  'brick-crumble': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 3200, endHz: 500, slide: 'exponential' },
        gain: { peak: 0.24, attackSeconds: 0.001, decaySeconds: 0.11 },
      },
    },
  ],

  /** Bright metal ping over a short scrape — a bullet bouncing off armour plate. */
  'steel-clang': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: 1600, endHz: 1200, slide: 'exponential' },
        gain: { peak: 0.14, attackSeconds: 0.001, decaySeconds: 0.06 },
      },
    },
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 7000, endHz: 2500, slide: 'exponential' },
        gain: { peak: 0.1, attackSeconds: 0.001, decaySeconds: 0.05 },
      },
    },
  ],

  /** A tank going up: a noise burst sitting on a short low thump. */
  'small-explosion': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 1800, endHz: 220, slide: 'exponential' },
        gain: { peak: 0.3, attackSeconds: 0.004, decaySeconds: 0.28 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 140, endHz: 60, slide: 'exponential' },
        gain: { peak: 0.22, attackSeconds: 0.004, decaySeconds: 0.22 },
      },
    },
  ],

  /** The player or the eagle: deeper, longer, with a second collapse rolling in behind it. */
  'big-explosion': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 1400, endHz: 90, slide: 'exponential' },
        gain: { peak: 0.38, attackSeconds: 0.006, decaySeconds: 0.55 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 100, endHz: 40, slide: 'exponential' },
        gain: { peak: 0.3, attackSeconds: 0.006, decaySeconds: 0.5 },
      },
    },
    {
      delaySeconds: 0.09,
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 700, endHz: 70, slide: 'exponential' },
        gain: { peak: 0.22, attackSeconds: 0.01, decaySeconds: 0.4 },
      },
    },
  ],

  /** Two rising blips that say "something landed on the field". */
  'power-up-appear': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('E5') },
        gain: { peak: 0.14, attackSeconds: 0.005, decaySeconds: 0.07 },
      },
    },
    {
      delaySeconds: FANFARE_STEP_SECONDS,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('B5') },
        gain: { peak: 0.14, attackSeconds: 0.005, decaySeconds: 0.1 },
      },
    },
  ],

  /** A four-step major arpeggio — the reward flourish. */
  'power-up-pickup': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('C5') },
        gain: { peak: 0.16, attackSeconds: 0.003, decaySeconds: 0.06 },
      },
    },
    {
      delaySeconds: ARPEGGIO_STEP_SECONDS,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('E5') },
        gain: { peak: 0.16, attackSeconds: 0.003, decaySeconds: 0.06 },
      },
    },
    {
      delaySeconds: ARPEGGIO_STEP_SECONDS * 2,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('G5') },
        gain: { peak: 0.16, attackSeconds: 0.003, decaySeconds: 0.06 },
      },
    },
    {
      delaySeconds: ARPEGGIO_STEP_SECONDS * 3,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('C6') },
        gain: { peak: 0.18, attackSeconds: 0.003, decaySeconds: 0.14 },
      },
    },
  ],

  /** Wider intervals and a held last note: the rarest good news in the game. */
  'extra-life': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('G4') },
        gain: { peak: 0.16, attackSeconds: 0.004, decaySeconds: 0.1 },
      },
    },
    {
      delaySeconds: FANFARE_STEP_SECONDS,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('C5') },
        gain: { peak: 0.16, attackSeconds: 0.004, decaySeconds: 0.1 },
      },
    },
    {
      delaySeconds: FANFARE_STEP_SECONDS * 2,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('E5') },
        gain: { peak: 0.16, attackSeconds: 0.004, decaySeconds: 0.1 },
      },
    },
    {
      delaySeconds: FANFARE_STEP_SECONDS * 3,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('G5') },
        gain: { peak: 0.18, attackSeconds: 0.004, decaySeconds: 0.3 },
      },
    },
  ],

  /** One dry blip, deliberately unmusical, so pausing never sounds like an achievement. */
  'pause-blip': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('A4') },
        gain: { peak: 0.12, attackSeconds: 0.003, decaySeconds: 0.06 },
      },
    },
  ],

  /** Filtered noise opening upward: the hiss of a tank losing its grip on ice. */
  'ice-skid': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 900, endHz: 2600, slide: 'linear' },
        gain: { peak: 0.1, attackSeconds: 0.02, decaySeconds: 0.22 },
      },
    },
  ],

  /** The tally blip of the stage summary — short, high, repeatable without fatigue. */
  'score-tick': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('E6') },
        gain: { peak: 0.1, attackSeconds: 0.001, decaySeconds: 0.03 },
      },
    },
  ],
};
