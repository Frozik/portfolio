import { getNoteFrequencyHz } from '@frozik/utils/audio/noteFrequency';
import type { SoundPatch } from '@frozik/utils/audio/synth';
import { clamp } from 'lodash-es';

/**
 * The sound inventory. Every entry is declarative data the shared synth renders, so the
 * whole palette can be re-voiced by editing numbers and validated without an audio device.
 * Nothing here is sampled or transcribed — artillery is noise and sine sweeps, which is exactly
 * what a synthesiser is good at.
 */
export type ScorchedSfxId =
  | 'shot'
  | 'whistle-fall'
  | 'small-explosion'
  | 'medium-explosion'
  | 'large-explosion'
  | 'dirt-rumble'
  | 'shield-hit'
  | 'shield-deflect'
  | 'mag-deflect'
  | 'napalm-crackle'
  | 'cash-register'
  | 'battery-charge'
  | 'retreat-helicopter'
  | 'laser-zap'
  | 'wall-bounce';

const ARPEGGIO_STEP_SECONDS = 0.05;
const ROTOR_BEAT_SECONDS = 0.11;
const ROTOR_BEAT_COUNT = 9;

/**
 * [MANUAL §8] The retreat helicopter: a chain of low noise thumps, each a rotor blade going past.
 * It swells as the machine arrives and thins out as it climbs away with its passenger.
 */
const RETREAT_HELICOPTER_PATCH: SoundPatch = Array.from(
  { length: ROTOR_BEAT_COUNT },
  (_unused, beatIndex) => {
    const progress = beatIndex / (ROTOR_BEAT_COUNT - 1);

    return {
      delaySeconds: beatIndex * ROTOR_BEAT_SECONDS,
      recipe: {
        waveform: 'noise' as const,
        pitch: { startHz: 260, endHz: 90, slide: 'exponential' as const },
        gain: {
          peak: 0.16 * (1 - progress * 0.7),
          attackSeconds: 0.004,
          decaySeconds: ROTOR_BEAT_SECONDS * 0.8,
        },
      },
    };
  }
);

/**
 * The falling shell's whistle, pitched by how fast the shell is going when it tips over the top of
 * its arc: a lobbed baby missile sighs down, a flat full-power nuke screams. One multiplier on an
 * otherwise fixed recipe — the cheap version of "whistle pitch follows fall speed".
 */
const WHISTLE_START_HZ = 1500;
const WHISTLE_END_HZ = 380;
/** A slow shell still whistles, it is just an octave down; a fast one is a fifth up. */
const WHISTLE_MIN_PITCH_SCALE = 0.55;
const WHISTLE_MAX_PITCH_SCALE = 1.5;
/** Halfway up the range, for the fixed entry in the palette below. */
const NEUTRAL_WHISTLE_SPEED_RATIO = 0.5;

export function createWhistlePatch(speedRatio: number): SoundPatch {
  const scale =
    WHISTLE_MIN_PITCH_SCALE +
    (WHISTLE_MAX_PITCH_SCALE - WHISTLE_MIN_PITCH_SCALE) * clamp(speedRatio, 0, 1);

  return [
    {
      recipe: {
        waveform: 'triangle',
        pitch: {
          startHz: WHISTLE_START_HZ * scale,
          endHz: WHISTLE_END_HZ * scale,
          slide: 'exponential',
        },
        gain: { peak: 0.1, attackSeconds: 0.05, decaySeconds: 0.6 },
      },
    },
  ];
}

export const SCORCHED_SFX_PATCHES: Readonly<Record<ScorchedSfxId, SoundPatch>> = {
  /** The barrel's crack: a hard noise transient over a short falling tone. */
  shot: [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 5000, endHz: 700, slide: 'exponential' },
        gain: { peak: 0.24, attackSeconds: 0.002, decaySeconds: 0.09 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 220, endHz: 70, slide: 'exponential' },
        gain: { peak: 0.2, attackSeconds: 0.003, decaySeconds: 0.14 },
      },
    },
  ],

  /**
   * The descending whistle of a shell on its way down — the classic artillery tell. This is the
   * neutral voicing; the engine plays {@link createWhistlePatch} instead when it knows how fast
   * the shell is falling.
   */
  'whistle-fall': createWhistlePatch(NEUTRAL_WHISTLE_SPEED_RATIO),

  /** A baby missile: brief, dry, over before the dirt has finished moving. */
  'small-explosion': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 2000, endHz: 260, slide: 'exponential' },
        gain: { peak: 0.28, attackSeconds: 0.004, decaySeconds: 0.26 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 150, endHz: 62, slide: 'exponential' },
        gain: { peak: 0.2, attackSeconds: 0.004, decaySeconds: 0.2 },
      },
    },
  ],

  /** A missile or a roller: more body, a slower tail. */
  'medium-explosion': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 1500, endHz: 150, slide: 'exponential' },
        gain: { peak: 0.34, attackSeconds: 0.005, decaySeconds: 0.45 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 110, endHz: 45, slide: 'exponential' },
        gain: { peak: 0.28, attackSeconds: 0.005, decaySeconds: 0.4 },
      },
    },
  ],

  /** A nuke: deep, long, with a second collapse rolling in behind the first. */
  'large-explosion': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 1100, endHz: 70, slide: 'exponential' },
        gain: { peak: 0.4, attackSeconds: 0.008, decaySeconds: 0.8 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 86, endHz: 32, slide: 'exponential' },
        gain: { peak: 0.34, attackSeconds: 0.008, decaySeconds: 0.75 },
      },
    },
    {
      delaySeconds: 0.13,
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 520, endHz: 55, slide: 'exponential' },
        gain: { peak: 0.24, attackSeconds: 0.02, decaySeconds: 0.6 },
      },
    },
  ],

  /** Tons of dirt letting go at once: low filtered noise with a slow attack. */
  'dirt-rumble': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 320, endHz: 90, slide: 'exponential' },
        gain: { peak: 0.2, attackSeconds: 0.08, decaySeconds: 0.7 },
      },
    },
  ],

  /** The bubble taking a hit: a bright metallic ring that dies fast. */
  'shield-hit': [
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 1750, endHz: 900, slide: 'exponential' },
        gain: { peak: 0.16, attackSeconds: 0.001, decaySeconds: 0.22 },
      },
    },
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 8000, endHz: 3000, slide: 'exponential' },
        gain: { peak: 0.1, attackSeconds: 0.001, decaySeconds: 0.08 },
      },
    },
  ],

  /**
   * A force shield throwing a shell back out. Deliberately nothing like `shield-hit`: that one is
   * the bubble *taking* the blow and rings high and thin, this one is the bubble *winning* and
   * lands as a hard downward clang, so the player hears which of the two just happened.
   */
  'shield-deflect': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: 900, endHz: 240, slide: 'exponential' },
        gain: { peak: 0.17, attackSeconds: 0.001, decaySeconds: 0.18 },
      },
    },
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 300, endHz: 120, slide: 'exponential' },
        gain: { peak: 0.14, attackSeconds: 0.002, decaySeconds: 0.3 },
      },
    },
  ],

  /**
   * A mag deflector taking hold of a passing shell: a rising magnetic warble, no impact in it at
   * all — nothing was struck, the shot was simply pushed off course.
   */
  'mag-deflect': [
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 180, endHz: 720, slide: 'exponential' },
        gain: { peak: 0.13, attackSeconds: 0.02, decaySeconds: 0.34 },
      },
    },
    {
      delaySeconds: 0.04,
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 240, endHz: 900, slide: 'exponential' },
        gain: { peak: 0.08, attackSeconds: 0.02, decaySeconds: 0.28 },
      },
    },
  ],

  /** Napalm catching: hissy noise that opens upward as the pool spreads. */
  'napalm-crackle': [
    {
      recipe: {
        waveform: 'noise',
        pitch: { startHz: 700, endHz: 3200, slide: 'linear' },
        gain: { peak: 0.14, attackSeconds: 0.04, decaySeconds: 0.9 },
      },
    },
  ],

  /** The shop's till: two bright blips and a ping, unmistakably "money changed hands". */
  'cash-register': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('E6') },
        gain: { peak: 0.11, attackSeconds: 0.002, decaySeconds: 0.05 },
      },
    },
    {
      delaySeconds: ARPEGGIO_STEP_SECONDS,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('B6') },
        gain: { peak: 0.11, attackSeconds: 0.002, decaySeconds: 0.14 },
      },
    },
  ],

  /** A battery going in: a short charging swell that settles, unmistakably a repair. */
  'battery-charge': [
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: getNoteFrequencyHz('C5'), endHz: getNoteFrequencyHz('G5') },
        gain: { peak: 0.12, attackSeconds: 0.03, decaySeconds: 0.18 },
      },
    },
    {
      delaySeconds: ARPEGGIO_STEP_SECONDS * 2,
      recipe: {
        waveform: 'square',
        pitch: { startHz: getNoteFrequencyHz('C6') },
        gain: { peak: 0.09, attackSeconds: 0.004, decaySeconds: 0.2 },
      },
    },
  ],

  /** The laser: a fast upward sweep, thin and synthetic on purpose. */
  'laser-zap': [
    {
      recipe: {
        waveform: 'square',
        pitch: { startHz: 300, endHz: 3600, slide: 'exponential' },
        gain: { peak: 0.14, attackSeconds: 0.001, decaySeconds: 0.16 },
      },
    },
  ],

  'retreat-helicopter': RETREAT_HELICOPTER_PATCH,

  /** A shell coming off a rubber wall: a short rubbery boing. */
  'wall-bounce': [
    {
      recipe: {
        waveform: 'triangle',
        pitch: { startHz: 640, endHz: 240, slide: 'exponential' },
        gain: { peak: 0.12, attackSeconds: 0.002, decaySeconds: 0.1 },
      },
    },
  ],
};
