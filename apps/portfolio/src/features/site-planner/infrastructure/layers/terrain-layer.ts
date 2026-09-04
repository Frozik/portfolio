import type { Vector2 } from '@frozik/utils/math/vector2';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { densifyRing } from '../../domain/geometry/densify-ring';
import type { MultiPolygon, Ring } from '../../domain/geometry/polygon-types';
import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';
import type { Heightfield } from '../../domain/terrain/heightfield';
import { computeElevationRange, sampleHeight } from '../../domain/terrain/heightfield';
import type { Meters } from '../../domain/units';
import { planToWorld } from '../../domain/view/world-frame';
import { DEPTH_FORMAT, MSAA_SAMPLE_COUNT, UNIFORM_ALIGNMENT_BYTES } from '../render-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import shadowShaderSource from '../shaders/shadow.wgsl?raw';
import terrainShaderSource from '../shaders/terrain.wgsl?raw';
import type { ShadowMap } from '../shadow-map';
import { SHADOW_FORMAT } from '../shadow-map';
import type { ShadowCaster } from './shadow-caster';

const terrainSource = commonShaderSource + shadowShaderSource + terrainShaderSource;

const FLOAT32_BYTES = 4;
const WORLD_FLOATS_PER_VERTEX = 3;
const OUTLINE_VERTEX_STRIDE = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;
/** Two triangles per grid cell. */
const INDICES_PER_CELL = 6;
/** Below two points there is no ring to walk. */
const MIN_RING_VERTEX_COUNT = 2;

/**
 * How far the boundary line floats over the ground it is draped on. Large
 * enough to clear the depth precision of a scene tens of metres across, small
 * enough to read as lying on the surface rather than hovering over it.
 */
const OUTLINE_ELEVATION_OFFSET: Meters = 0.03;

/** Denominator floor of the height tint: level terrain must not divide by zero. */
const MIN_ELEVATION_SPAN: Meters = 0.001;

/** The format the analysis raster is authored in: eight bits per RGBA channel. */
const OVERLAY_FORMAT: GPUTextureFormat = 'rgba8unorm';
const OVERLAY_CHANNELS_PER_TEXEL = 4;
/** Denominator floor of the overlay lookup, for a raster of no extent at all. */
const MIN_OVERLAY_SPAN: Meters = 0.001;
/** Half a texel: the raster's first texel is centred on the first grid sample. */
const HALF_TEXEL = 0.5;

/**
 * What the ground samples while no analysis is on: one fully transparent texel.
 * A binding cannot simply be left out, and a texture that shows nothing is a
 * shorter answer than a second pipeline without one.
 */
const PLACEHOLDER_OVERLAY_SIZE = 1;

/** The texture and the plan geometry of the analysis currently on the ground. */
interface OverlayResources {
  readonly widthTexels: number;
  readonly heightTexels: number;
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
}

/** What the ground is built from; the layer keeps nothing else about the plan. */
interface TerrainInput {
  readonly field: Heightfield;
  readonly boundaryPolygons: MultiPolygon;
  /** One value per grid sample, in the field's row-major order. */
  readonly coverage: Float32Array;
}

/** The resources whose size follows the grid resolution. */
interface GridResources {
  readonly resolution: number;
  readonly elevations: GPUBuffer;
  readonly coverage: GPUBuffer;
  readonly indexBuffer: GPUBuffer;
  readonly indexCount: number;
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
  private overlayUniformView!: StructuredView;
  private overlayUniformBuffer!: GPUBuffer;
  private overlaySampler!: GPUSampler;
  private placeholderOverlay!: OverlayResources;

  private gridResources: GridResources | undefined;
  private overlayResources: OverlayResources | undefined;
  /**
   * Points at both the grid buffers and the overlay texture, so it is rebuilt
   * whenever either of them is replaced.
   */
  private terrainBindGroup: GPUBindGroup | undefined;
  private outlineBuffer: GPUBuffer | undefined;
  private outlineVertexCount = 0;

  /** Terrain handed over before the device came up, uploaded as soon as it does. */
  private pendingTerrain: TerrainInput | undefined;
  /**
   * The overlay handed over before the device came up — or the fact that it was
   * switched off then, which is why the flag is carried apart from the raster.
   */
  private pendingOverlay: AnalysisRaster | undefined;
  private hasPendingOverlay = false;

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
    this.overlayUniformView = makeStructuredView(shaderDefinitions.uniforms.Overlay);
    this.overlayUniformBuffer = createUniformBuffer(device, this.overlayUniformView);
    // Nearest, matching the plan's own `imageSmoothingEnabled = false`: one
    // texel is one grid sample, and only an identical rule leaves the two views
    // agreeing texel for texel.
    this.overlaySampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    this.placeholderOverlay = createOverlayTexture(
      device,
      PLACEHOLDER_OVERLAY_SIZE,
      PLACEHOLDER_OVERLAY_SIZE
    );

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

    // The camera passes read the shadow map through group 1; the shadow pass
    // writes it, and so must be built without it — a texture cannot be an
    // attachment and a bound resource of the same pass.
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout, this.shadowMap.bindGroupLayout],
    });
    const shadowPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.shadowPipeline = device.createRenderPipeline({
      layout: shadowPipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vsTerrainShadow' },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });

    this.gridPipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'vsTerrain' },
      fragment: { module: shaderModule, entryPoint: 'fsTerrain', targets: [{ format }] },
      // The terrain is a single sheet, so it has to hold up when the camera
      // drops below the horizon and looks at its underside.
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    this.outlinePipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vsBoundaryOutline',
        buffers: [
          {
            arrayStride: OUTLINE_VERTEX_STRIDE,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: { module: shaderModule, entryPoint: 'fsBoundaryOutline', targets: [{ format }] },
      primitive: { topology: 'line-list' },
      // The line rides just over the ground and must not shadow what stands on
      // it, so it tests against the terrain without writing its own depth.
      depthStencil: {
        format: DEPTH_FORMAT,
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    // Written before anything is drawn: an untouched uniform would leave the
    // lookup dividing the plan by a span of zero, and a NaN reaching the mix
    // would take the ground with it.
    this.writeOverlayUniform(device, undefined);
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
    this.pendingOverlay = raster;
    this.hasPendingOverlay = true;
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

    const gridResources = this.gridResources;
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
    const gridResources = this.gridResources;
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
    this.releaseGridResources();
    this.releaseOverlayResources();
    this.placeholderOverlay.texture.destroy();
    this.outlineBuffer?.destroy();
    this.outlineBuffer = undefined;
    this.outlineVertexCount = 0;
    this.gridUniformBuffer.destroy();
    this.overlayUniformBuffer.destroy();
    this.terrainBindGroup = undefined;
    this.device = undefined;
    this.pendingTerrain = undefined;
    this.pendingOverlay = undefined;
    this.hasPendingOverlay = false;
  }

  private uploadPendingTerrain(): void {
    const device = this.device;
    const terrain = this.pendingTerrain;

    if (isNil(device) || isNil(terrain)) {
      return;
    }

    this.pendingTerrain = undefined;

    const { field, boundaryPolygons } = terrain;
    const { elevations, coverage } = this.ensureGridResources(device, field.resolution);

    device.queue.writeBuffer(elevations, 0, field.heights);
    device.queue.writeBuffer(coverage, 0, terrain.coverage);
    this.writeGridUniform(device, field);
    this.uploadOutline(device, field, boundaryPolygons);
  }

  /**
   * The buffers sized by the grid. They survive every edit that keeps the
   * resolution — which is every edit but a change of the sampling setting — so
   * a moved survey mark costs one upload and no allocation.
   */
  private ensureGridResources(device: GPUDevice, resolution: number): GridResources {
    const existing = this.gridResources;

    if (!isNil(existing) && existing.resolution === resolution) {
      return existing;
    }

    this.releaseGridResources();

    const sampleByteLength = resolution * resolution * FLOAT32_BYTES;
    const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const indices = buildGridIndices(resolution);
    const indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(indexBuffer, 0, indices);

    const elevations = device.createBuffer({ size: sampleByteLength, usage: storageUsage });
    const coverage = device.createBuffer({ size: sampleByteLength, usage: storageUsage });
    const resources: GridResources = {
      resolution,
      elevations,
      coverage,
      indexBuffer,
      indexCount: indices.length,
    };

    this.gridResources = resources;
    this.refreshBindGroup();

    return resources;
  }

  /**
   * Uploads the analysis raster and tells the ground where on the plan it lies.
   * The placement is carried in metres rather than assumed to match the grid:
   * the terrain and the overlay reach the layer through reactions of their own,
   * and neither may be read against a stale copy of the other.
   */
  private uploadPendingOverlay(): void {
    const device = this.device;

    if (isNil(device) || !this.hasPendingOverlay) {
      return;
    }

    this.hasPendingOverlay = false;

    const raster = this.pendingOverlay;

    this.pendingOverlay = undefined;

    if (isNil(raster)) {
      this.releaseOverlayResources();
      this.refreshBindGroup();
      this.writeOverlayUniform(device, undefined);

      return;
    }

    const { widthTexels, heightTexels, pixels } = raster;
    const resources = this.ensureOverlayResources(device, widthTexels, heightTexels);

    device.queue.writeTexture(
      { texture: resources.texture },
      pixels,
      { bytesPerRow: widthTexels * OVERLAY_CHANNELS_PER_TEXEL, rowsPerImage: heightTexels },
      { width: widthTexels, height: heightTexels }
    );
    this.writeOverlayUniform(device, raster);
  }

  /** The texture sized by the raster; a new one only when the raster resizes. */
  private ensureOverlayResources(
    device: GPUDevice,
    widthTexels: number,
    heightTexels: number
  ): OverlayResources {
    const existing = this.overlayResources;

    if (
      !isNil(existing) &&
      existing.widthTexels === widthTexels &&
      existing.heightTexels === heightTexels
    ) {
      return existing;
    }

    this.releaseOverlayResources();

    const resources = createOverlayTexture(device, widthTexels, heightTexels);

    this.overlayResources = resources;
    this.refreshBindGroup();

    return resources;
  }

  /**
   * Rebuilds the bind group against whatever the grid buffers and the overlay
   * texture are now: a bind group holds the resources it was made with, so
   * replacing either of them makes it stale.
   */
  private refreshBindGroup(): void {
    const device = this.device;
    const gridResources = this.gridResources;

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
        { binding: 4, resource: { buffer: this.overlayUniformBuffer } },
        {
          binding: 5,
          resource: (this.overlayResources ?? this.placeholderOverlay).view,
        },
        { binding: 6, resource: this.overlaySampler },
      ],
    });
  }

  private writeOverlayUniform(device: GPUDevice, raster: AnalysisRaster | undefined): void {
    if (isNil(raster)) {
      this.overlayUniformView.set({ minPosition: [0, 0], span: [1, 1], enabled: 0 });
    } else {
      const { originMeters, cellSizeMeters, widthTexels, heightTexels } = raster;

      this.overlayUniformView.set({
        minPosition: [
          originMeters.x - cellSizeMeters * HALF_TEXEL,
          originMeters.y - cellSizeMeters * HALF_TEXEL,
        ],
        span: [
          Math.max(widthTexels * cellSizeMeters, MIN_OVERLAY_SPAN),
          Math.max(heightTexels * cellSizeMeters, MIN_OVERLAY_SPAN),
        ],
        enabled: 1,
      });
    }

    device.queue.writeBuffer(this.overlayUniformBuffer, 0, this.overlayUniformView.arrayBuffer);
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

  private releaseGridResources(): void {
    const resources = this.gridResources;

    if (isNil(resources)) {
      return;
    }

    resources.elevations.destroy();
    resources.coverage.destroy();
    resources.indexBuffer.destroy();
    this.gridResources = undefined;
    this.terrainBindGroup = undefined;
  }

  private releaseOverlayResources(): void {
    this.overlayResources?.texture.destroy();
    this.overlayResources = undefined;
  }
}

function createUniformBuffer(device: GPUDevice, view: StructuredView): GPUBuffer {
  return device.createBuffer({
    size:
      Math.ceil(view.arrayBuffer.byteLength / UNIFORM_ALIGNMENT_BYTES) * UNIFORM_ALIGNMENT_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createOverlayTexture(
  device: GPUDevice,
  widthTexels: number,
  heightTexels: number
): OverlayResources {
  const texture = device.createTexture({
    size: [widthTexels, heightTexels],
    format: OVERLAY_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  return { widthTexels, heightTexels, texture, view: texture.createView() };
}

/**
 * Triangle indices of a `resolution × resolution` grid of samples, two per cell.
 * Row-major, matching the elevations: sample (column, row) is
 * `row * resolution + column`, which is also what the vertex shader reverses.
 */
function buildGridIndices(resolution: number): Uint32Array {
  const cellsPerSide = resolution - 1;
  const indices = new Uint32Array(cellsPerSide * cellsPerSide * INDICES_PER_CELL);

  let offset = 0;

  for (let row = 0; row < cellsPerSide; row += 1) {
    for (let column = 0; column < cellsPerSide; column += 1) {
      const southWest = row * resolution + column;
      const southEast = southWest + 1;
      const northWest = southWest + resolution;
      const northEast = northWest + 1;

      indices[offset] = southWest;
      indices[offset + 1] = southEast;
      indices[offset + 2] = northEast;
      indices[offset + 3] = southWest;
      indices[offset + 4] = northEast;
      indices[offset + 5] = northWest;
      offset += INDICES_PER_CELL;
    }
  }

  return indices;
}

/**
 * The boundary as world-space line segments lying on the terrain. Every ring is
 * first split down to the cell size: a straight edge lifted only at its two ends
 * would cut through every rise between them.
 */
function buildOutlinePositions(field: Heightfield, polygons: MultiPolygon): Float32Array {
  const positions: number[] = [];

  for (const polygon of polygons) {
    appendRingOutline(positions, field, polygon.outer);

    for (const hole of polygon.holes) {
      appendRingOutline(positions, field, hole);
    }
  }

  return Float32Array.from(positions);
}

function appendRingOutline(positions: number[], field: Heightfield, ring: Ring): void {
  const draped = densifyRing(ring, field.cellSizeMeters);

  if (draped.length < MIN_RING_VERTEX_COUNT) {
    return;
  }

  for (let index = 0; index < draped.length; index += 1) {
    appendOutlinePoint(positions, field, draped[index]);
    appendOutlinePoint(positions, field, draped[(index + 1) % draped.length]);
  }
}

function appendOutlinePoint(positions: number[], field: Heightfield, point: Vector2): void {
  const elevation = sampleHeight(field, point.x, point.y) + OUTLINE_ELEVATION_OFFSET;
  const [x, y, z] = planToWorld(point, elevation);

  positions.push(x, y, z);
}
