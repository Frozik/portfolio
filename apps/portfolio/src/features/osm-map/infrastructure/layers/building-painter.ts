import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh } from '@frozik/utils/webgpu/gpuMesh';

import { MAX_BUILDING_TILES_PER_FRAME } from '../../domain/constants';
import buildingsShaderSource from '../shaders/buildings.wgsl?raw';
import type { StreetTileCache } from '../street-tile-cache';
import type { MapFrame } from './map-frame';
import type { StreetPainter, StreetPassResources } from './street-painter';
import { createStreetPipeline, PLACEMENTS_BINDING, UNIFORM_BINDING } from './street-painter';

/** Building vertices: four `int16` in tenths of a metre, the fourth unused — see `BuildingMesh`. */
const BUILDING_VERTEX_BUFFERS: readonly GPUVertexBufferLayout[] = [
  {
    arrayStride: 4 * Int16Array.BYTES_PER_ELEMENT,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'sint16x4' }],
  },
];

interface BuildingDraw {
  readonly mesh: GpuMesh;
  readonly placementIndex: number;
}

/** The building boxes: one lit and fogged draw per z14 tile, placed by the tile's index into the frame's placements. */
export class BuildingPainter implements StreetPainter {
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private draws: readonly BuildingDraw[] = [];

  constructor(
    resources: StreetPassResources,
    private readonly cache: StreetTileCache
  ) {
    const layout = resources.device.createBindGroupLayout({
      entries: [UNIFORM_BINDING, PLACEMENTS_BINDING],
    });
    this.pipeline = createStreetPipeline(
      resources,
      layout,
      buildingsShaderSource,
      BUILDING_VERTEX_BUFFERS
    );
    this.bindGroup = resources.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: resources.uniformBuffer } },
        { binding: 1, resource: { buffer: resources.placementBuffer } },
      ],
    });
  }

  update(frame: MapFrame): boolean {
    this.draws = frame.streetTiles
      .slice(0, MAX_BUILDING_TILES_PER_FRAME)
      .flatMap((placement, placementIndex) => {
        const mesh = this.cache.buildingsOf(placement.key);
        return mesh === undefined ? [] : [{ mesh, placementIndex }];
      });
    return this.draws.length > 0;
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.draws.length === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    for (const { mesh, placementIndex } of this.draws) {
      bindGpuMesh(pass, mesh);
      pass.drawIndexed(mesh.indexCount, 1, 0, 0, placementIndex);
    }
  }

  dispose(): void {}
}
