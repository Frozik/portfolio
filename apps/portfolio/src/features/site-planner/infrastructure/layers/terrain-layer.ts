import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import type { MultiPolygon } from '../../domain/geometry/polygon-types';
import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';
import type { Heightfield } from '../../domain/terrain/heightfield';
import { computeElevationRange } from '../../domain/terrain/heightfield';
import type { Meters } from '../../domain/units';
import commonShaderSource from '../shaders/common.wgsl?raw';
import shadowShaderSource from '../shaders/shadow.wgsl?raw';
import terrainShaderSource from '../shaders/terrain.wgsl?raw';
import type { ShadowMap } from '../shadow-map';
import type { ShadowCaster } from './shadow-caster';
import { buildOutlinePositions, WORLD_FLOATS_PER_VERTEX } from './terrain-geometry';
import { TerrainGrid } from './terrain-grid';
import { TerrainOverlay } from './terrain-overlay';
import { createTerrainPipelines } from './terrain-pipelines';
import { createUniformBuffer } from './uniform-buffer';

const terrainSource = commonShaderSource + shadowShaderSource + terrainShaderSource;

/** Denominator floor of the height tint: level terrain must not divide by zero. */
const MIN_ELEVATION_SPAN: Meters = 0.001;

/** What the ground is built from; the layer keeps nothing else about the plan. */
interface TerrainInput {
  readonly field: Heightfield;
  readonly boundaryPolygons: MultiPolygon;
  /** One value per grid sample, in the field's row-major order. */
  readonly coverage: Float32Array;
}

/**
 * The terrain of the plot: a regular grid over the plot's bounding box, drawn
 * without a vertex buffer — a vertex reads its own position off `vertex_index`
 * and its elevation out of a storage buffer, and only the index buffer says how
 * the samples become triangles. Editing a survey mark is therefore one
 * `writeBuffer`, with the pipeline and the geometry untouched; the buffers
 * themselves are rebuilt only when the grid changes resolution.
 *
 * The grid spans the bounding box while the plot may fill any part of it, so
 * every sample carries how much of the plot covers it: the fragments beyond the
 * boundary are dropped and leave the sky, and the accent outline draped along
 * the boundary is what the ground ends on.
 *
 * Its pass is what clears the shared depth buffer and stores both attachments:
 * the objects standing on the ground are drawn after it, against that very
 * depth, and it is their pass that resolves the frame onto the canvas.
 */
export class TerrainLayer implements RenderLayer, ShadowCaster {
  private device: GPUDevice | undefined;
  private format!: GPUTextureFormat;
  private bindGroupLayout!: GPUBindGroupLayout;
  private gridPipeline!: GPURenderPipeline;
  private outlinePipeline!: GPURenderPipeline;
  private shadowPipeline!: GPURenderPipeline;

  private gridUniformView!: StructuredView;
  private gridUniformBuffer!: GPUBuffer;
  private readonly grid = new TerrainGrid();
  private readonly overlay = new TerrainOverlay();
  /**
   * Points at both the grid buffers and the overlay texture, so it is rebuilt
   * whenever either of them is replaced.
   */
  private terrainBindGroup: GPUBindGroup | undefined;
  private outlineBuffer: GPUBuffer | undefined;
  private outlineVertexCount = 0;

  /** Terrain handed over before the device came up, uploaded as soon as it does. */
  private pendingTerrain: TerrainInput | undefined;

  constructor(
    private readonly sceneUniformBuffer: GPUBuffer,
    private readonly msaaManager: MsaaTextureManager,
    private readonly depthManager: DepthTextureManager,
    private readonly shadowMap: ShadowMap
  ) {}

  init({ device, format }: GpuContext): void {
    this.device = device;
    this.format = format;

    const shaderModule = device.createShaderModule({ code: terrainSource });
    const shaderDefinitions = makeShaderDataDefinitions(terrainSource);

    this.gridUniformView = makeStructuredView(shaderDefinitions.uniforms.Grid);
    this.gridUniformBuffer = createUniformBuffer(device, this.gridUniformView);
    this.overlay.init(device, shaderDefinitions.uniforms.Overlay);

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 6, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    const pipelines = createTerrainPipelines(device, shaderModule, format, {
      terrain: this.bindGroupLayout,
      shadow: this.shadowMap.bindGroupLayout,
    });

    this.shadowPipeline = pipelines.shadowPipeline;
    this.gridPipeline = pipelines.gridPipeline;
    this.outlinePipeline = pipelines.outlinePipeline;

    this.refreshBindGroup();
    this.uploadPendingTerrain();
    this.uploadPendingOverlay();
  }

  /** Replaces the ground with a freshly sampled terrain and its boundary. */
  applyTerrain(terrain: TerrainInput): void {
    this.pendingTerrain = terrain;
    this.uploadPendingTerrain();
  }

  /**
   * Colours the ground with an analysis, or takes the colour off it. The raster
   * is the plan's own — the ground never derives a colour of its own, which is
   * what keeps the two views from drifting apart.
   */
  applyOverlay(raster: AnalysisRaster | undefined): void {
    this.overlay.apply(raster);
    this.uploadPendingOverlay();
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, _canvasView: GPUTextureView, state: FrameState): void {
    const device = this.device;

    if (isNil(device)) {
      return;
    }

    const msaaView = this.msaaManager.ensureView(
      device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );

    if (isNil(msaaView)) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: msaaView, loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: {
        view: this.depthManager.ensureView(device, state.canvasWidth, state.canvasHeight),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    const gridResources = this.grid.resources;
    const bindGroup = this.terrainBindGroup;

    if (!isNil(gridResources) && !isNil(bindGroup)) {
      pass.setBindGroup(0, bindGroup);
      pass.setBindGroup(1, this.shadowMap.bindGroup);
      pass.setPipeline(this.gridPipeline);
      pass.setIndexBuffer(gridResources.indexBuffer, 'uint32');
      pass.drawIndexed(gridResources.indexCount);

      if (!isNil(this.outlineBuffer) && this.outlineVertexCount > 0) {
        pass.setPipeline(this.outlinePipeline);
        pass.setVertexBuffer(0, this.outlineBuffer);
        pass.draw(this.outlineVertexCount);
      }
    }

    pass.end();
  }

  /** The ground as the sun sees it: the same grid, drawn into the shadow map. */
  drawShadow(pass: GPURenderPassEncoder): void {
    const gridResources = this.grid.resources;
    const bindGroup = this.terrainBindGroup;

    if (isNil(gridResources) || isNil(bindGroup)) {
      return;
    }

    pass.setPipeline(this.shadowPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setIndexBuffer(gridResources.indexBuffer, 'uint32');
    pass.drawIndexed(gridResources.indexCount);
  }

  dispose(): void {
    this.grid.release();
    this.overlay.dispose();
    this.outlineBuffer?.destroy();
    this.outlineBuffer = undefined;
    this.outlineVertexCount = 0;
    this.gridUniformBuffer.destroy();
    this.terrainBindGroup = undefined;
    this.device = undefined;
    this.pendingTerrain = undefined;
  }

  private uploadPendingTerrain(): void {
    const device = this.device;
    const terrain = this.pendingTerrain;

    if (isNil(device) || isNil(terrain)) {
      return;
    }

    this.pendingTerrain = undefined;

    const { field, boundaryPolygons } = terrain;
    const { resources, isNew } = this.grid.ensure(device, field.resolution);

    if (isNew) {
      this.refreshBindGroup();
    }

    device.queue.writeBuffer(resources.elevations, 0, field.heights);
    device.queue.writeBuffer(resources.coverage, 0, terrain.coverage);
    this.writeGridUniform(device, field);
    this.uploadOutline(device, field, boundaryPolygons);
  }

  private uploadPendingOverlay(): void {
    const device = this.device;

    if (!isNil(device) && this.overlay.upload(device)) {
      this.refreshBindGroup();
    }
  }

  /**
   * Rebuilds the bind group against whatever the grid buffers and the overlay
   * texture are now: a bind group holds the resources it was made with, so
   * replacing either of them makes it stale.
   */
  private refreshBindGroup(): void {
    const device = this.device;
    const gridResources = this.grid.resources;

    if (isNil(device) || isNil(gridResources)) {
      this.terrainBindGroup = undefined;

      return;
    }

    this.terrainBindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneUniformBuffer } },
        { binding: 1, resource: { buffer: this.gridUniformBuffer } },
        { binding: 2, resource: { buffer: gridResources.elevations } },
        { binding: 3, resource: { buffer: gridResources.coverage } },
        { binding: 4, resource: { buffer: this.overlay.uniformBuffer } },
        { binding: 5, resource: this.overlay.view },
        { binding: 6, resource: this.overlay.sampler },
      ],
    });
  }

  private writeGridUniform(device: GPUDevice, field: Heightfield): void {
    const { minElevation, maxElevation } = computeElevationRange(field);

    this.gridUniformView.set({
      origin: [field.originMeters.x, field.originMeters.y],
      cellSize: field.cellSizeMeters,
      resolution: field.resolution,
      minElevation,
      elevationSpan: Math.max(maxElevation - minElevation, MIN_ELEVATION_SPAN),
    });

    device.queue.writeBuffer(this.gridUniformBuffer, 0, this.gridUniformView.arrayBuffer);
  }

  private uploadOutline(device: GPUDevice, field: Heightfield, polygons: MultiPolygon): void {
    const positions = buildOutlinePositions(field, polygons);

    this.outlineVertexCount = positions.length / WORLD_FLOATS_PER_VERTEX;

    if (this.outlineVertexCount === 0) {
      return;
    }

    if (isNil(this.outlineBuffer) || this.outlineBuffer.size < positions.byteLength) {
      this.outlineBuffer?.destroy();
      this.outlineBuffer = device.createBuffer({
        size: positions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    device.queue.writeBuffer(this.outlineBuffer, 0, positions);
  }
}
