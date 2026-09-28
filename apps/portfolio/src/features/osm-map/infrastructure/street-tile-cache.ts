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
import type { MapTreeSpecies, TreeBatch } from '../domain/tree-cover';
import { INT16_PER_TREE } from '../domain/tree-cover';
import type { WaterMesh } from '../domain/water-surface';

/** The trees of one species in a tile as the GPU holds them: an instance buffer and how many it holds. */
export interface ResidentTrees {
  readonly species: MapTreeSpecies;
  readonly buffer: GPUBuffer;
  readonly count: number;
}

interface ResidentTile {
  /** Nothing for a tile with no buildings, which is still a tile the loader need not fetch again. */
  readonly buildings: GpuMesh | undefined;
  readonly roads: readonly RoadLine[];
  /** Nothing for a tile with no water. */
  readonly water: GpuMesh | undefined;
  readonly trees: readonly ResidentTrees[];
  readonly bytes: number;
}

/** An empty tile still occupies a cache entry; the cache cannot count it as nothing. */
const EMPTY_TILE_BYTES = 1;
/** What a road vertex costs in memory, roughly: the point, its key and the cumulative distance. */
const ROAD_POINT_BYTES = 64;

/** The one vertex buffer of a street mesh, `int16` positions; nothing for a mesh with no triangles. */
function uploadStreetMesh(device: GPUDevice, mesh: BuildingMesh | WaterMesh): GpuMesh | undefined {
  if (mesh.indices.length === 0) {
    return undefined;
  }
  return {
    vertexBuffers: [createVertexBuffer(device, mesh.positions)],
    indexBuffer: createIndexBuffer(device, mesh.indices),
    indexCount: mesh.indices.length,
  };
}

function uploadTrees(device: GPUDevice, batches: readonly TreeBatch[]): readonly ResidentTrees[] {
  return batches.map(({ species, instances }) => ({
    species,
    buffer: createVertexBuffer(device, instances),
    count: instances.length / INT16_PER_TREE,
  }));
}

/**
 * Street tiles resident on the GPU, one per z14 tile, bounded by their
 * bytes: the least recently drawn tile is released when a new one does not
 * fit. The 3D counterpart of the raster atlas; the roads, the water and the
 * trees ride along with the mesh so a returning tile gets its traffic,
 * ripples and woods back at once.
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
      dispose: resident => {
        releaseGpuMesh(resident.buildings);
        releaseGpuMesh(resident.water);
        for (const trees of resident.trees) {
          trees.buffer.destroy();
        }
      },
    });
  }

  store(key: TileKey, tile: StreetTile): void {
    const { buildings, roads, water, trees } = tile;
    const bytes =
      buildings.positions.byteLength +
      buildings.indices.byteLength +
      water.positions.byteLength +
      water.indices.byteLength +
      trees.reduce((sum, batch) => sum + batch.instances.byteLength, 0) +
      roads.reduce((sum, road) => sum + road.points.length * ROAD_POINT_BYTES, 0);
    this.tiles.set(key, {
      buildings: uploadStreetMesh(this.device, buildings),
      roads,
      water: uploadStreetMesh(this.device, water),
      trees: uploadTrees(this.device, trees),
      bytes,
    });
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

  waterOf(key: TileKey): GpuMesh | undefined {
    return this.tiles.peek(key)?.water;
  }

  hasWater(key: TileKey): boolean {
    return this.waterOf(key) !== undefined;
  }

  treesOf(key: TileKey): readonly ResidentTrees[] {
    return this.tiles.peek(key)?.trees ?? [];
  }

  dispose(): void {
    this.tiles.clear();
  }
}
