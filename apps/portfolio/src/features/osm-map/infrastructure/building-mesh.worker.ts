import type { TileCoord } from '../domain/tile-key';
import { decodeBuildingTile } from './building-tile-decoder';

export interface BuildingMeshRequest {
  readonly id: number;
  readonly bytes: ArrayBuffer;
  readonly coord: TileCoord;
}

export interface BuildingMeshResponse {
  readonly id: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

/** Decoding and extruding a dense city tile takes tens of milliseconds: off the frame thread. */
self.onmessage = ({ data }: MessageEvent<BuildingMeshRequest>): void => {
  const mesh = decodeBuildingTile(data.bytes, data.coord);
  const response: BuildingMeshResponse = { id: data.id, ...mesh };
  self.postMessage(response, {
    transfer: [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer],
  });
};
