import { VIEW_PIXELS_PER_METER } from './camera';

/** The measures a bar may show, shortest first: the round numbers of a map's scale. */
const MEASURES_METERS: readonly number[] = [1, 2, 5, 10];
/** A bar shorter than this on the screen reads as a dash: the next measure is taken. */
const MIN_BAR_PIXELS = 40;

/** A length of the world drawn on the screen: what the distances of the HUD are read against. */
export interface ScaleBar {
  readonly meters: number;
  /** CSS pixels. */
  readonly pixels: number;
}

/** The bar for a zoom: one metre while that is long enough to see, the next round measure once it is not. */
export function scaleBarFor(zoom: number): ScaleBar {
  const pixelsPerMeter = VIEW_PIXELS_PER_METER * zoom;
  const meters =
    MEASURES_METERS.find(measure => measure * pixelsPerMeter >= MIN_BAR_PIXELS) ??
    MEASURES_METERS[MEASURES_METERS.length - 1];
  return { meters, pixels: meters * pixelsPerMeter };
}
