/**
 * Shared scene background across all WebGPU demos (`#07090c`).
 *
 * Exposed in two forms because the demos consume it differently:
 * `SCENE_BACKGROUND_COLOR` is the GPU `clearValue` object (channels in
 * 0..1), while `SCENE_BACKGROUND_HEX` is the CSS string used as a 2D
 * canvas `fillStyle`. Both describe the same colour.
 */
export const SCENE_BACKGROUND_HEX = '#07090c';

export interface ISceneBackgroundColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export const SCENE_BACKGROUND_COLOR: ISceneBackgroundColor = {
  r: 0.02745,
  g: 0.03529,
  b: 0.04706,
  a: 1,
};
