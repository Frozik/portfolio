import { random } from 'lodash-es';

/** The backdrops the round can open on — our own gradients, one picked at random. */
type SkyPresetId = 'plain' | 'stars' | 'shaded' | 'sunset' | 'cavern' | 'black';

export interface SkyPreset {
  readonly id: SkyPresetId;
  /** Gradient endpoints as GPU channels in 0..1: the colour at the top and at the horizon. */
  readonly topColor: readonly [number, number, number];
  readonly horizonColor: readonly [number, number, number];
  /** Stars per 100 × 100 wu of sky; zero leaves a clean gradient. */
  readonly starDensity: number;
}

const NO_STARS = 0;

const SKY_PRESETS: readonly SkyPreset[] = [
  {
    id: 'plain',
    topColor: [0.16, 0.35, 0.62],
    horizonColor: [0.55, 0.72, 0.86],
    starDensity: NO_STARS,
  },
  {
    id: 'stars',
    topColor: [0.02, 0.03, 0.11],
    horizonColor: [0.09, 0.12, 0.26],
    starDensity: 5,
  },
  {
    id: 'shaded',
    topColor: [0.09, 0.16, 0.28],
    horizonColor: [0.42, 0.5, 0.58],
    starDensity: NO_STARS,
  },
  {
    id: 'sunset',
    topColor: [0.18, 0.11, 0.35],
    horizonColor: [0.95, 0.48, 0.24],
    starDensity: 1,
  },
  {
    id: 'cavern',
    topColor: [0.08, 0.07, 0.06],
    horizonColor: [0.25, 0.18, 0.13],
    starDensity: NO_STARS,
  },
  {
    id: 'black',
    topColor: [0.01, 0.01, 0.02],
    horizonColor: [0.04, 0.04, 0.06],
    starDensity: NO_STARS,
  },
];

export function pickRandomSkyPreset(): SkyPreset {
  return SKY_PRESETS[random(SKY_PRESETS.length - 1)];
}
