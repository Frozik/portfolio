import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import { FIELD_QUAD_VERTEX_COUNT } from '../render-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import fieldQuadShaderSource from '../shaders/field-quad.wgsl?raw';
import terrainShaderSource from '../shaders/terrain.wgsl?raw';
import type { TerrainTextureSet } from '../terrain-texture';

const terrainSource = commonShaderSource + fieldQuadShaderSource + terrainShaderSource;

const PING_PONG_PARITIES = [0, 1] as const;

/**
 * The terrain: one quad over the field sampling whichever of the ping-ponged textures
 * the compute passes left current. Nearest sampling keeps the dirt chunky as the field is scaled
 * up; the fractional upscale is deliberate, this is not tile art.
 */
export class TerrainLayer implements RenderLayer {
  private pipeline!: GPURenderPipeline;
  private bindGroups: readonly GPUBindGroup[] = [];
  private sampler!: GPUSampler;

  constructor(
    private readonly uniformBuffer: GPUBuffer,
    private readonly textures: TerrainTextureSet
  ) {}

  init(context: GpuContext): void {
    const { device, format } = context;
    const shaderModule = device.createShaderModule({ code: terrainSource });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    this.sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vsFieldQuad' },
      fragment: { module: shaderModule, entryPoint: 'fsTerrain', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    this.bindGroups = PING_PONG_PARITIES.map(parity =>
      device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: this.textures.getView(parity) },
          { binding: 2, resource: this.sampler },
        ],
      })
    );
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroups[this.textures.currentIndex]);
    pass.draw(FIELD_QUAD_VERTEX_COUNT);
    pass.end();
  }

  dispose(): void {
    this.bindGroups = [];
  }
}
