import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import type { TileCoord } from '../domain/tile-key';
import type { BuildingMeshRequest, BuildingMeshResponse } from './building-mesh.worker';

export interface BuildingMeshDecoder {
  decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<LitMesh>;
  dispose(): void;
}

interface PendingDecode {
  readonly resolve: (mesh: LitMesh) => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * The main-thread end of the mesh worker: one request per tile, answered by
 * id. An aborted request rejects at once and its answer, when it comes, is
 * dropped — the worker never learns of the abort, it just finishes.
 */
export function createBuildingMeshDecoder(): BuildingMeshDecoder {
  const worker = new Worker(new URL('./building-mesh.worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, PendingDecode>();
  let nextId = 0;

  worker.onmessage = ({ data }: MessageEvent<BuildingMeshResponse>): void => {
    const request = pending.get(data.id);
    if (request === undefined) {
      return;
    }
    pending.delete(data.id);
    request.resolve({ positions: data.positions, normals: data.normals, indices: data.indices });
  };
  worker.onerror = (event: ErrorEvent): void => {
    for (const request of pending.values()) {
      request.reject(event.error ?? new Error(event.message));
    }
    pending.clear();
  };

  return {
    async decode(bytes: Blob, coord: TileCoord, signal: AbortSignal): Promise<LitMesh> {
      signal.throwIfAborted();
      const buffer = await bytes.arrayBuffer();
      signal.throwIfAborted();
      const id = nextId++;
      return new Promise<LitMesh>((resolve, reject) => {
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
        const request: BuildingMeshRequest = { id, bytes: buffer, coord };
        worker.postMessage(request, [buffer]);
      });
    },
    dispose(): void {
      worker.terminate();
      for (const request of pending.values()) {
        request.reject(new Error('Building mesh decoder disposed'));
      }
      pending.clear();
    },
  };
}
