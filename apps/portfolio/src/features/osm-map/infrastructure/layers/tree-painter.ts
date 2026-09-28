import { buildTreeTemplate } from '@frozik/utils/geometry/treeTemplate';
import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh, releaseGpuMesh, uploadColoredMesh } from '@frozik/utils/webgpu/gpuMesh';

import { MAX_BUILDING_TILES_PER_FRAME } from '../../domain/constants';
import type { MapTreeSpecies } from '../../domain/tree-cover';
import { INT16_PER_TREE, MAP_TREE_SPECIES } from '../../domain/tree-cover';
import treesShaderSource from '../shaders/trees.wgsl?raw';
import type { ResidentTrees, StreetTileCache } from '../street-tile-cache';
import type { MapFrame } from './map-frame';
import type { StreetPainter, StreetPassResources } from './street-painter';
import { createStreetPipeline, UNIFORM_BINDING } from './street-painter';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const VERTEX_STRIDE_BYTES = 3 * FLOAT_BYTES;
const FLOATS_PER_PLACEMENT = 4;
const PLACEMENT_BYTES = FLOATS_PER_PLACEMENT * FLOAT_BYTES;
const TEMPLATE_VERTEX_BUFFER_COUNT = 3;

/** The template's position, normal and colour, then one tree per instance — see `TreeBatch`. */
const TREE_VERTEX_BUFFERS: readonly GPUVertexBufferLayout[] = [
  {
    arrayStride: VERTEX_STRIDE_BYTES,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
  },
  {
    arrayStride: VERTEX_STRIDE_BYTES,
    attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
  },
  {
    arrayStride: VERTEX_STRIDE_BYTES,
    attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }],
  },
  {
    arrayStride: INT16_PER_TREE * Int16Array.BYTES_PER_ELEMENT,
    stepMode: 'instance',
    attributes: [{ shaderLocation: 3, offset: 0, format: 'sint16x4' }],
  },
];

interface TreeDraw {
  readonly trees: ResidentTrees;
  /** Byte offset of the tile's placement in the strided placement buffer. */
  readonly placementOffset: number;
}

/**
 * The woods and parks: every tile's trees are instances of one template per
 * species, kept on the GPU with the tile. An instanced draw reads its
 * instance buffer from index zero, so the tile cannot be picked by
 * `firstInstance` the way the boxes are; instead each draw binds its
 * placement through a dynamic offset into a uniform buffer strided to the
 * device's alignment.
 */
export class TreePainter implements StreetPainter {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly placementBuffer: GPUBuffer;
  private readonly placementStride: number;
  private readonly placementData: Float32Array;
  private readonly templates: ReadonlyMap<MapTreeSpecies, GpuMesh>;
  private draws: readonly TreeDraw[] = [];

  constructor(
    resources: StreetPassResources,
    private readonly cache: StreetTileCache
  ) {
    this.device = resources.device;
    this.placementStride = Math.max(
      PLACEMENT_BYTES,
      this.device.limits.minUniformBufferOffsetAlignment
    );
    this.placementData = new Float32Array(
      (MAX_BUILDING_TILES_PER_FRAME * this.placementStride) / FLOAT_BYTES
    );
    this.placementBuffer = this.device.createBuffer({
      size: this.placementData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.templates = new Map(
      MAP_TREE_SPECIES.flatMap(species => {
        const mesh = uploadColoredMesh(this.device, buildTreeTemplate(species));
        return mesh === undefined ? [] : [[species, mesh] as const];
      })
    );
    const layout = this.device.createBindGroupLayout({
      entries: [
        UNIFORM_BINDING,
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: PLACEMENT_BYTES },
        },
      ],
    });
    this.pipeline = createStreetPipeline(resources, layout, treesShaderSource, TREE_VERTEX_BUFFERS);
    this.bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: resources.uniformBuffer } },
        {
          binding: 1,
          resource: { buffer: this.placementBuffer, size: PLACEMENT_BYTES },
        },
      ],
    });
  }

  /** Only the tiles with trees get a placement slot; a draw per species per tile. */
  update(frame: MapFrame): boolean {
    const draws: TreeDraw[] = [];
    let slot = 0;
    for (const placement of frame.streetTiles) {
      const trees = this.cache.treesOf(placement.key);
      if (trees.length === 0 || slot === MAX_BUILDING_TILES_PER_FRAME) {
        continue;
      }
      const placementOffset = slot * this.placementStride;
      const base = placementOffset / FLOAT_BYTES;
      this.placementData[base] = placement.offsetX;
      this.placementData[base + 1] = placement.offsetZ;
      this.placementData[base + 2] = placement.scale;
      this.placementData[base + 3] = placement.riseStart;
      for (const batch of trees) {
        draws.push({ trees: batch, placementOffset });
      }
      slot++;
    }
    if (slot > 0) {
      this.device.queue.writeBuffer(
        this.placementBuffer,
        0,
        this.placementData,
        0,
        (slot * this.placementStride) / FLOAT_BYTES
      );
    }
    this.draws = draws;
    return draws.length > 0;
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.draws.length === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    for (const { trees, placementOffset } of this.draws) {
      const template = this.templates.get(trees.species);
      if (template === undefined) {
        continue;
      }
      pass.setBindGroup(0, this.bindGroup, [placementOffset]);
      bindGpuMesh(pass, template);
      pass.setVertexBuffer(TEMPLATE_VERTEX_BUFFER_COUNT, trees.buffer);
      pass.drawIndexed(template.indexCount, trees.count);
    }
  }

  dispose(): void {
    this.placementBuffer.destroy();
    for (const mesh of this.templates.values()) {
      releaseGpuMesh(mesh);
    }
  }
}
