import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import type { SkyPreset } from '../../domain/sky-presets';
import { FIELD_QUAD_VERTEX_COUNT } from '../render-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import fieldQuadShaderSource from '../shaders/field-quad.wgsl?raw';
import skyShaderSource from '../shaders/sky.wgsl?raw';

const skySource = commonShaderSource + fieldQuadShaderSource + skyShaderSource;

/** `SkyParams`: two `vec4<f32>` colours, the star density and its padding. */
const SKY_PARAM_FLOATS = 12;
const TOP_COLOR_OFFSET = 0;
const HORIZON_COLOR_OFFSET = 4;
const STAR_DENSITY_OFFSET = 8;
const OPAQUE = 1;

/**
 * The backdrop, drawn over the whole field. First layer of the frame, so it also clears
 * the letterbox around the field to the shared scene background.
 */
export class SkyLayer implements RenderLayer {
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private paramsBuffer!: GPUBuffer;

  constructor(
    private readonly uniformBuffer: GPUBuffer,
    private readonly preset: SkyPreset
  ) {}

  init(context: GpuContext): void {
    const { device, format } = context;
    const shaderModule = device.createShaderModule({ code: skySource });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vsFieldQuad' },
      fragment: { module: shaderModule, entryPoint: 'fsSky', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    const params = new Float32Array(SKY_PARAM_FLOATS);

    params.set([...this.preset.topColor, OPAQUE], TOP_COLOR_OFFSET);
    params.set([...this.preset.horizonColor, OPAQUE], HORIZON_COLOR_OFFSET);
    params[STAR_DENSITY_OFFSET] = this.preset.starDensity;

    this.paramsBuffer = device.createBuffer({
      size: params.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.paramsBuffer, 0, params);

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          loadOp: 'clear',
          clearValue: SCENE_BACKGROUND_COLOR,
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(FIELD_QUAD_VERTEX_COUNT);
    pass.end();
  }

  dispose(): void {
    this.paramsBuffer.destroy();
  }
}
