import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IRpcClient, TRpcError } from '@frozik/utils/worker/rpc-client';
import { createRpcClient } from '@frozik/utils/worker/rpc-client';

import type { StreetTile } from '../domain/street-tile';
import type { TileCoord } from '../domain/tile-key';
import type { TStreetTileContract } from './street-tile.worker';

export interface StreetTileDecoder {
  decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<StreetTile>;
  dispose(): void;
}

/**
 * The main-thread end of the street tile worker; the tile loader treats any
 * rejection as a failed tile. A crashed worker is replaced on the next tile.
 */
export function createStreetTileDecoder(): StreetTileDecoder {
  let client: IRpcClient<TStreetTileContract> | null = null;
  let disposed = false;
  const connect = (): IRpcClient<TStreetTileContract> =>
    createRpcClient<TStreetTileContract>(
      new Worker(new URL('./street-tile.worker.ts', import.meta.url), { type: 'module' })
    );

  return {
    async decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<StreetTile> {
      if (disposed) {
        throw new Error('Street tile decoder disposed');
      }
      const buffer = await bytes.arrayBuffer();
      const current = (client ??= connect());
      const result = await current.call(
        'decode',
        { bytes: buffer, coord },
        { signal, transfer: [buffer] }
      );
      if (result.ok) {
        return result.value;
      }
      if (result.error.kind === 'worker-crashed' && client === current) {
        client = null;
      }
      throw toDecodeFailure(result.error, signal);
    },
    dispose(): void {
      disposed = true;
      client?.dispose();
      client = null;
    },
  };
}

function toDecodeFailure(error: TRpcError, signal: AbortSignal): unknown {
  switch (error.kind) {
    case 'aborted':
      return signal.reason;
    case 'not-sent':
    case 'handler-threw':
      return error.error;
    case 'worker-crashed':
      return new Error('Street tile worker crashed', { cause: error.reason });
    case 'disposed':
      return new Error('Street tile decoder disposed');
    default:
      return assertNever(error);
  }
}
