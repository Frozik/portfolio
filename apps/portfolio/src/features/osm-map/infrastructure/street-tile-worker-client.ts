import type { StreetTile } from '../domain/street-tile';
import type { TileCoord } from '../domain/tile-key';
import type { StreetTileRequest, StreetTileResponse } from './street-tile.worker';

export interface StreetTileDecoder {
  decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<StreetTile>;
  dispose(): void;
}

interface PendingDecode {
  readonly resolve: (tile: StreetTile) => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * The main-thread end of the street tile worker: one request per tile,
 * answered by id. An aborted request rejects at once and its answer, when
 * it comes, is dropped — the worker never learns of the abort, it just
 * finishes.
 */
export function createStreetTileDecoder(): StreetTileDecoder {
  const worker = new Worker(new URL('./street-tile.worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, PendingDecode>();
  let nextId = 0;

  worker.onmessage = ({ data }: MessageEvent<StreetTileResponse>): void => {
    const request = pending.get(data.id);
    if (request === undefined) {
      return;
    }
    pending.delete(data.id);
    request.resolve({
      buildings: { positions: data.positions, indices: data.indices },
      roads: data.roads,
      water: data.water,
      trees: data.trees,
    });
  };
  worker.onerror = (event: ErrorEvent): void => {
    for (const request of pending.values()) {
      request.reject(event.error ?? new Error(event.message));
    }
    pending.clear();
  };

  return {
    async decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<StreetTile> {
      signal.throwIfAborted();
      const buffer = await bytes.arrayBuffer();
      signal.throwIfAborted();
      const id = nextId++;
      return new Promise<StreetTile>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        signal.addEventListener(
          'abort',
          () => {
            if (pending.delete(id)) {
              reject(signal.reason);
            }
          },
          { once: true }
        );
        const request: StreetTileRequest = { id, bytes: buffer, coord };
        worker.postMessage(request, [buffer]);
      });
    },
    dispose(): void {
      worker.terminate();
      for (const request of pending.values()) {
        request.reject(new Error('Street tile decoder disposed'));
      }
      pending.clear();
    },
  };
}
