import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import {
  MAX_SHAPE_BUFFER_COUNT,
  SHAPE_FADE_DURATION,
  SHAPE_VERTICES_PER_INSTANCE,
} from '../../domain/chart-constants';
import type { ShapeBounds, ShapeInstance } from '../../domain/chart-shapes';
import {
  computeShapeCount,
  replaceExpiredShapes,
  resizeShapes,
  spawnStaggeredShapes,
} from '../../domain/chart-shapes';
import commonShaderSource from '../shaders/common.wgsl?raw';
import shapesSpecificSource from '../shaders/shapes.wgsl?raw';
import {
  createShapeDataBuffer,
  SHAPE_INSTANCE_BYTES,
  writeShapeInstances,
} from '../shape-instance-buffer';
import type { UniformManager } from '../uniform-manager';

const shapesShaderSource = commonShaderSource + shapesSpecificSource;

const PREMULTIPLIED_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};

/** A population of fading shapes sized to the canvas, uploaded once per frame as instances. */
export class ShapesLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly storageBuffer: GPUBuffer;
  private readonly shapeData = createShapeDataBuffer(MAX_SHAPE_BUFFER_COUNT);
  private shapes: readonly ShapeInstance[] = [];

  constructor(context: GpuContext, uniformManager: UniformManager) {
    this.device = context.device;
    const shaderModule = this.device.createShaderModule({ code: shapesShaderSource });
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });
    this.storageBuffer = this.device.createBuffer({
      size: MAX_SHAPE_BUFFER_COUNT * SHAPE_INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vsShapes',
        constants: { FADE_DURATION: SHAPE_FADE_DURATION },
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsShapes',
        targets: [{ format: context.format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformManager.buffer } },
        { binding: 1, resource: { buffer: this.storageBuffer } },
      ],
    });
  }

  update(state: FrameState): void {
    const { time, canvasWidth, canvasHeight, devicePixelRatio } = state;
    const bounds: ShapeBounds = { halfWidth: canvasWidth / 2, halfHeight: canvasHeight / 2 };
    const count = computeShapeCount(canvasWidth, canvasHeight, devicePixelRatio);

    const population =
      this.shapes.length === 0
        ? spawnStaggeredShapes(count, time, bounds)
        : resizeShapes(this.shapes, count, time, bounds);
    this.shapes = replaceExpiredShapes(population, time, bounds);

    const byteLength = writeShapeInstances(this.shapeData, this.shapes);
    this.device.queue.writeBuffer(this.storageBuffer, 0, this.shapeData.buffer, 0, byteLength);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    if (this.shapes.length === 0) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(SHAPE_VERTICES_PER_INSTANCE, this.shapes.length, 0, 0);
    pass.end();
  }

  dispose(): void {
    this.storageBuffer.destroy();
  }
}
