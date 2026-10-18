import { AIM_DEAD_ZONE_METERS, MAX_PULL_METERS } from '../../domain/constants';
import { distance } from '../../domain/vector';
import type { DrawnBand } from './scene-frame';

const FULL_CHARGE_TOLERANCE = 1e-9;

/** How far the band is stretched, in band metres — the same on the screen however far the view is zoomed. */
export function stretchOf(band: DrawnBand): number {
  return distance(band.anchor, band.pull) / band.meterOnBoard;
}

/**
 * How strong the stroke a stretch plays: nothing at the softest stroke, all
 * at the strongest. A stretch measured back off the board at the strongest
 * stroke comes out a hair short of it, and the last ring and the light past it
 * would never light: that hair counts as full.
 */
export function chargeOf(stretchMeters: number): number {
  const share = (stretchMeters - AIM_DEAD_ZONE_METERS) / (MAX_PULL_METERS - AIM_DEAD_ZONE_METERS);
  return share >= 1 - FULL_CHARGE_TOLERANCE ? 1 : Math.max(0, share);
}
