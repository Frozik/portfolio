import type { Mat4 } from 'wgpu-matrix';

import type { WorldVector } from '../../domain/map-camera';
import type { TileKey } from '../../domain/tile-key';

/** Where a building tile's mesh stands this frame: its corner relative to the camera target, and metres → map units. */
export interface BuildingPlacement {
  readonly key: TileKey;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly scale: number;
  /** Frame time the tile entered the picture; its boxes grow from the ground over `BUILDING_RISE_SECONDS`. */
  readonly riseStart: number;
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
  readonly buildings: readonly BuildingPlacement[];
}
