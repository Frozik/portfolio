import { isNil } from 'lodash-es';

import { buildGridIndices, FLOAT32_BYTES } from './terrain-geometry';

/** The resources whose size follows the grid resolution. */
export interface GridResources {
  readonly resolution: number;
  readonly elevations: GPUBuffer;
  readonly coverage: GPUBuffer;
  readonly indexBuffer: GPUBuffer;
  readonly indexCount: number;
}

/**
 * The buffers sized by the grid. They survive every edit that keeps the
 * resolution — which is every edit but a change of the sampling setting — so
 * a moved survey mark costs one upload and no allocation.
 */
export class TerrainGrid {
  private current: GridResources | undefined;

  get resources(): GridResources | undefined {
    return this.current;
  }

  /** The buffers for this resolution; true when they were just (re)built and bindings are stale. */
  ensure(
    device: GPUDevice,
    resolution: number
  ): { readonly resources: GridResources; readonly isNew: boolean } {
    const existing = this.current;

    if (!isNil(existing) && existing.resolution === resolution) {
      return { resources: existing, isNew: false };
    }

    this.release();

    const sampleByteLength = resolution * resolution * FLOAT32_BYTES;
    const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const indices = buildGridIndices(resolution);
    const indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(indexBuffer, 0, indices);

    const resources: GridResources = {
      resolution,
      elevations: device.createBuffer({ size: sampleByteLength, usage: storageUsage }),
      coverage: device.createBuffer({ size: sampleByteLength, usage: storageUsage }),
      indexBuffer,
      indexCount: indices.length,
    };

    this.current = resources;

    return { resources, isNew: true };
  }

  release(): void {
    const resources = this.current;

    if (isNil(resources)) {
      return;
    }

    resources.elevations.destroy();
    resources.coverage.destroy();
    resources.indexBuffer.destroy();
    this.current = undefined;
  }
}
