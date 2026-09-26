import type { Mat4 } from 'wgpu-matrix';

import type { CarBody } from '../../domain/car-bodies';
import type { WorldVector } from '../../domain/map-camera';
import type { TileKey } from '../../domain/tile-key';

/** Where a street tile stands this frame: its corner relative to the camera target, and metres → map units. */
export interface StreetTilePlacement {
  readonly key: TileKey;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly scale: number;
  /** Frame time the tile entered the picture; its boxes grow from the ground over `BUILDING_RISE_SECONDS`. */
  readonly riseStart: number;
}

/** One car this frame, in plan metres from its tile's corner (x east, y north). */
export interface CarInstance {
  /** Index into the frame's `streetTiles`. */
  readonly placementIndex: number;
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly body: CarBody;
  readonly colorIndex: number;
}

/** What the scene hands the layers for a frame that changed. */
export interface MapFrame {
  readonly viewProjection: Mat4;
  /** Camera position relative to the camera target, like the instance origins. */
  readonly cameraPosition: WorldVector;
  readonly fogStart: number;
  readonly fogEnd: number;
  readonly time: number;
  readonly instanceData: Float32Array;
  readonly instanceCount: number;
  readonly streetTiles: readonly StreetTilePlacement[];
  readonly cars: readonly CarInstance[];
}
