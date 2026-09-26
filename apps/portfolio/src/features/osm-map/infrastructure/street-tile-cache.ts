import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import {
  createIndexBuffer,
  createVertexBuffer,
  releaseGpuMesh,
} from '@frozik/utils/webgpu/gpuMesh';
import { LRUCache } from 'lru-cache';

import type { BuildingMesh } from '../domain/building-footprint';
import { MAX_BUILDING_MESH_BYTES } from '../domain/constants';
import type { TileSink } from '../domain/ports/tile-sink';
import type { RoadLine } from '../domain/road-lines';
import type { StreetTile } from '../domain/street-tile';
import type { TileKey } from '../domain/tile-key';

interface ResidentTile {
  /** Nothing for a tile with no buildings, which is still a tile the loader need not fetch again. */
  readonly buildings: GpuMesh | undefined;
  readonly roads: readonly RoadLine[];
  readonly bytes: number;
}

/** An empty tile still occupies a cache entry; the cache cannot count it as nothing. */
const EMPTY_TILE_BYTES = 1;
/** What a road vertex costs in memory, roughly: the point, its key and the cumulative distance. */
const ROAD_POINT_BYTES = 64;

/** The one vertex buffer of a building mesh, `int16x4` per vertex; nothing for a tile with no buildings. */
function uploadBuildingMesh(device: GPUDevice, mesh: BuildingMesh): GpuMesh | undefined {
  if (mesh.indices.length === 0) {
    return undefined;
  }
  return {
    vertexBuffers: [createVertexBuffer(device, mesh.positions)],
    indexBuffer: createIndexBuffer(device, mesh.indices),
    indexCount: mesh.indices.length,
  };
}

/**
 * Street tiles resident on the GPU, one per z14 tile, bounded by their
 * bytes: the least recently drawn tile is released when a new one does not
 * fit. The 3D counterpart of the raster atlas; the roads ride along with
 * the mesh so a returning tile gets its traffic back at once.
 */
export class StreetTileCache implements TileSink<StreetTile> {
  private readonly tiles: LRUCache<TileKey, ResidentTile>;

  constructor(
    private readonly device: GPUDevice,
    maxBytes: number = MAX_BUILDING_MESH_BYTES
  ) {
    this.tiles = new LRUCache<TileKey, ResidentTile>({
      maxSize: maxBytes,
      sizeCalculation: resident => Math.max(EMPTY_TILE_BYTES, resident.bytes),
      dispose: resident => releaseGpuMesh(resident.buildings),
    });
  }

  store(key: TileKey, tile: StreetTile): void {
    const { buildings, roads } = tile;
    const bytes =
      buildings.positions.byteLength +
      buildings.indices.byteLength +
      roads.reduce((sum, road) => sum + road.points.length * ROAD_POINT_BYTES, 0);
    this.tiles.set(key, { buildings: uploadBuildingMesh(this.device, buildings), roads, bytes });
  }

  has(key: TileKey): boolean {
    return this.tiles.has(key);
  }

  touch(key: TileKey): void {
    this.tiles.get(key);
  }

  buildingsOf(key: TileKey): GpuMesh | undefined {
    return this.tiles.peek(key)?.buildings;
  }

  roadsOf(key: TileKey): readonly RoadLine[] {
    return this.tiles.peek(key)?.roads ?? [];
  }

  dispose(): void {
    this.tiles.clear();
  }
}
