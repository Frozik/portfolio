import type { CourseCup, SectorSlice } from '../../domain/course';
import type { Sector } from '../../domain/generator/generate-sector';
import type { Bounds } from '../../domain/level';
import type { LevelMeshes } from '../render/level-geometry';
import { buildLevelMeshes } from '../render/level-geometry';
import type { MeshData } from '../render/mesh-writer';

export interface GpuMesh {
  readonly buffer: GPUBuffer;
  readonly vertexCount: number;
}

export type SectorGpuMeshes = Readonly<Record<keyof LevelMeshes, GpuMesh>>;

interface Entry {
  /** The cup as it was when the meshes were built: the notch and the flag are part of them. */
  readonly cup: CourseCup | undefined;
  readonly bounds: Bounds;
  readonly gpu: SectorGpuMeshes;
}

/**
 * The static meshes of the course, a set per sector: built when a sector
 * appears, rebuilt only when the cup comes to it or leaves it, destroyed
 * when the sector is dropped. The course grows a sector at a time while the
 * ball travels, and a sector is a few milliseconds of triangulation — the
 * whole course would be a hitch.
 */
export class SectorMeshCache {
  private readonly entries = new Map<Sector, Entry>();

  constructor(private readonly upload: (data: MeshData) => GpuMesh) {}

  sync(slices: readonly SectorSlice[]): void {
    const standing = new Set(slices.map(slice => slice.sector));
    for (const [sector, entry] of this.entries) {
      if (!standing.has(sector)) {
        this.release(entry);
        this.entries.delete(sector);
      }
    }
    for (const slice of slices) {
      const entry = this.entries.get(slice.sector);
      if (entry !== undefined && entry.cup === slice.cup) {
        continue;
      }
      if (entry !== undefined) {
        this.release(entry);
      }
      const meshes = buildLevelMeshes(slice.level);
      this.entries.set(slice.sector, {
        cup: slice.cup,
        bounds: slice.bounds,
        gpu: {
          fill: this.upload(meshes.fill),
          decor: this.upload(meshes.decor),
          surfaces: this.upload(meshes.surfaces),
        },
      });
    }
  }

  /** The meshes of the sectors that reach into `box`. */
  within(box: Bounds): readonly SectorGpuMeshes[] {
    const shown: SectorGpuMeshes[] = [];
    for (const entry of this.entries.values()) {
      const { min, max } = entry.bounds;
      if (max.x >= box.min.x && min.x <= box.max.x && max.y >= box.min.y && min.y <= box.max.y) {
        shown.push(entry.gpu);
      }
    }
    return shown;
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      this.release(entry);
    }
    this.entries.clear();
  }

  private release(entry: Entry): void {
    for (const mesh of Object.values(entry.gpu)) {
      mesh.buffer.destroy();
    }
  }
}
