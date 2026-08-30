import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { MSAA_SAMPLE_COUNT } from '../render-constants';
import skyShaderSource from '../shaders/sky.wgsl?raw';

const SKY_TRIANGLE_VERTEX_COUNT = 3;

/**
 * The gradient behind the site. First layer of the frame, so it is also the one
 * that clears the multisampled target the layers after it draw into — they all
 * share it, and the last of them resolves it onto the canvas.
 */
export class SkyLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;

  constructor(private readonly msaaManager: MsaaTextureManager) {}

  init({ device, format }: GpuContext): void {
    this.device = device;
    this.format = format;

    const shaderModule = device.createShaderModule({ code: skyShaderSource });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [] }),
      vertex: { module: shaderModule, entryPoint: 'vsSky' },
      fragment: { module: shaderModule, entryPoint: 'fsSky', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, _canvasView: GPUTextureView, state: FrameState): void {
    const msaaView = this.msaaManager.ensureView(
      this.device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );

    if (isNil(msaaView)) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          loadOp: 'clear',
          clearValue: SCENE_BACKGROUND_COLOR,
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.draw(SKY_TRIANGLE_VERTEX_COUNT);
    pass.end();
  }

  dispose(): void {}
}
