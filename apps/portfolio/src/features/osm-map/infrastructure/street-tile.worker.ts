import type { RoadLine } from '../domain/road-lines';
import type { TileCoord } from '../domain/tile-key';
import type { TreeBatch } from '../domain/tree-cover';
import type { WaterMesh } from '../domain/water-surface';
import { decodeStreetTile } from './street-tile-decoder';

export interface StreetTileRequest {
  readonly id: number;
  readonly bytes: ArrayBuffer;
  readonly coord: TileCoord;
}

export interface StreetTileResponse {
  readonly id: number;
  readonly positions: Int16Array;
  readonly indices: Uint32Array;
  readonly roads: readonly RoadLine[];
  readonly water: WaterMesh;
  readonly trees: readonly TreeBatch[];
}

/** Decoding and extruding a dense city tile takes tens of milliseconds: off the frame thread. */
self.onmessage = ({ data }: MessageEvent<StreetTileRequest>): void => {
  const { buildings, roads, water, trees } = decodeStreetTile(data.bytes, data.coord);
  const response: StreetTileResponse = { id: data.id, ...buildings, roads, water, trees };
  self.postMessage(response, {
    transfer: [
      buildings.positions.buffer,
      buildings.indices.buffer,
      water.positions.buffer,
      water.indices.buffer,
      ...trees.map(batch => batch.instances.buffer),
    ],
  });
};
