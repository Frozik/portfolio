import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { releaseGpuMesh, uploadLitMesh } from '@frozik/utils/webgpu/gpuMesh';
import { LRUCache } from 'lru-cache';

import { MAX_BUILDING_MESH_BYTES } from '../domain/constants';
import type { TileSink } from '../domain/ports/tile-sink';
import type { TileKey } from '../domain/tile-key';

interface ResidentMesh {
  /** Nothing for a tile with no buildings, which is still a tile the loader need not fetch again. */
  readonly mesh: GpuMesh | undefined;
  readonly bytes: number;
}

/** An empty tile still occupies a cache entry; the cache cannot count it as nothing. */
const EMPTY_TILE_BYTES = 1;

/**
 * Building meshes on the GPU, one per z14 tile, bounded by their vertex
 * bytes: the least recently drawn tile is released when a new one does not
 * fit. The 3D counterpart of the raster atlas.
 */
export class BuildingMeshCache implements TileSink<LitMesh> {
  private readonly meshes: LRUCache<TileKey, ResidentMesh>;

  constructor(
    private readonly device: GPUDevice,
    maxBytes: number = MAX_BUILDING_MESH_BYTES
  ) {
    this.meshes = new LRUCache<TileKey, ResidentMesh>({
      maxSize: maxBytes,
      sizeCalculation: resident => Math.max(EMPTY_TILE_BYTES, resident.bytes),
      dispose: resident => releaseGpuMesh(resident.mesh),
    });
  }

  store(key: TileKey, mesh: LitMesh): void {
    const bytes = mesh.positions.byteLength + mesh.normals.byteLength + mesh.indices.byteLength;
    this.meshes.set(key, { mesh: uploadLitMesh(this.device, mesh), bytes });
  }

  has(key: TileKey): boolean {
    return this.meshes.has(key);
  }

  touch(key: TileKey): void {
    this.meshes.get(key);
  }

  meshOf(key: TileKey): GpuMesh | undefined {
    return this.meshes.peek(key)?.mesh;
  }

  dispose(): void {
    this.meshes.clear();
  }
}
