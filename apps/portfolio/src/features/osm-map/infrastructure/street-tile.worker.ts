import type { RoadLine } from '../domain/road-lines';
import type { TileCoord } from '../domain/tile-key';
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
}

/** Decoding and extruding a dense city tile takes tens of milliseconds: off the frame thread. */
self.onmessage = ({ data }: MessageEvent<StreetTileRequest>): void => {
  const { buildings, roads } = decodeStreetTile(data.bytes, data.coord);
  const response: StreetTileResponse = { id: data.id, ...buildings, roads };
  self.postMessage(response, {
    transfer: [buildings.positions.buffer, buildings.indices.buffer],
  });
};
