import type { TileCoord } from '../tile-key';

/** Which tiles the atlas holds around a given one, by ground extent. */
export interface TileCoverage {
  /** The deepest resident tile whose ground fully contains `coord`, if any. */
  nearestAncestor(coord: TileCoord): TileCoord | undefined;
  /** Resident tiles inside `coord`, at most `maxDepth` levels below it. */
  descendants(coord: TileCoord, maxDepth: number): readonly TileCoord[];
}
