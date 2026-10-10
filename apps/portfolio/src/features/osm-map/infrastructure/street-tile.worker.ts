import { serveRpc } from '@frozik/utils/worker/rpc-server';

import type { StreetTile } from '../domain/street-tile';
import type { TileCoord } from '../domain/tile-key';
import { decodeStreetTile } from './street-tile-decoder';

export type TStreetTileContract = {
  readonly decode: {
    readonly request: { readonly bytes: ArrayBuffer; readonly coord: TileCoord };
    readonly response: StreetTile;
  };
};

/** Decoding and extruding a dense city tile takes tens of milliseconds: off the frame thread. */
serveRpc<TStreetTileContract>(self, {
  decode: {
    handle: ({ bytes, coord }) => decodeStreetTile(bytes, coord),
    transfer: ({ buildings, water, trees }) => [
      buildings.positions.buffer,
      buildings.indices.buffer,
      water.positions.buffer,
      water.indices.buffer,
      ...trees.map(batch => batch.instances.buffer),
    ],
  },
});
