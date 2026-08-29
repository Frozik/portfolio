import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import {
  HALF,
  MAX_SHAPE_BUFFER_COUNT,
  SHAPE_FADE_DURATION,
  SHAPE_INSTANCE_BYTES,
  SHAPE_VERTICES_PER_INSTANCE,
} from '../../domain/chart-constants';
import {
  computeShapeCount,
  createShapeDataBuffer,
  getShapeLifetime,
  initializeShapes,
  randomInRange,
  resizeShapes,
  spawnShape,
  writeShapeToBuffer,
} from '../../domain/chart-shapes';
import commonShaderSource from '../shaders/common.wgsl?raw';
import shapesSpecificSource from '../shaders/shapes.wgsl?raw';
import type { UniformManager } from '../uniform-manager';

const shapesShaderSource = commonShaderSource + shapesSpecificSource;

const FLOATS_PER_SHAPE = SHAPE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT;

export class ShapesLayer implements RenderLayer {
  private device!: GPUDevice;
  private shapesPipeline!: GPURenderPipeline;
  private shapesBindGroup!: GPUBindGroup;
  private shapesStorageBuffer!: GPUBuffer;

  private readonly shapeDataBuffer = createShapeDataBuffer(MAX_SHAPE_BUFFER_COUNT);
  private shapes: ReturnType<typeof initializeShapes> = [];

  constructor(private readonly uniformManager: UniformManager) {}

  init(context: GpuContext): void {
    this.device = context.device;

    const shapesShaderModule = this.device.createShaderModule({
      code: shapesShaderSource,
    });

    const shapesBindGroupLayout = this.device.createBindGroupLayout({
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

    this.shapesStorageBuffer = this.device.createBuffer({
      size: MAX_SHAPE_BUFFER_COUNT * SHAPE_INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.shapesPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [shapesBindGroupLayout],
      }),
      vertex: {
        module: shapesShaderModule,
        entryPoint: 'vsShapes',
        constants: { FADE_DURATION: SHAPE_FADE_DURATION },
      },
      fragment: {
        module: shapesShaderModule,
        entryPoint: 'fsShapes',
        targets: [
          {
            format: context.format,
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.shapesBindGroup = this.device.createBindGroup({
      layout: shapesBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformManager.buffer } },
        { binding: 1, resource: { buffer: this.shapesStorageBuffer } },
      ],
    });
  }

  update(state: FrameState): void {
    const { time, canvasWidth, canvasHeight, devicePixelRatio } = state;
    const halfWidth = canvasWidth * HALF;
    const halfHeight = canvasHeight * HALF;

    if (this.shapes.length === 0) {
      const initialCount = computeShapeCount(canvasWidth, canvasHeight, devicePixelRatio);
      this.shapes = initializeShapes(initialCount);
    }

    const currentShapeCount = computeShapeCount(canvasWidth, canvasHeight, devicePixelRatio);
    if (currentShapeCount !== this.shapes.length) {
      resizeShapes(this.shapes, currentShapeCount, time, halfWidth, halfHeight);
    }

    for (let shapeIndex = 0; shapeIndex < this.shapes.length; shapeIndex++) {
      const shape = this.shapes[shapeIndex];
      const elapsed = time - shape.spawnTime;
      const lifetime = getShapeLifetime(shape);

      if (elapsed > lifetime) {
        const newShape = spawnShape(time);
        newShape.x = randomInRange(-halfWidth + newShape.halfSize, halfWidth - newShape.halfSize);
        newShape.y = randomInRange(-halfHeight + newShape.halfSize, halfHeight - newShape.halfSize);
        this.shapes[shapeIndex] = newShape;
      }

      writeShapeToBuffer(
        this.shapes[shapeIndex],
        this.shapeDataBuffer,
        shapeIndex * FLOATS_PER_SHAPE
      );
    }

    this.device.queue.writeBuffer(
      this.shapesStorageBuffer,
      0,
      this.shapeDataBuffer.buffer,
      0,
      this.shapes.length * SHAPE_INSTANCE_BYTES
    );
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, _state: FrameState): void {
    if (this.shapes.length === 0) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(this.shapesPipeline);
    pass.setBindGroup(0, this.shapesBindGroup);
    pass.draw(SHAPE_VERTICES_PER_INSTANCE, this.shapes.length, 0, 0);
    pass.end();
  }

  dispose(): void {
    this.shapesStorageBuffer.destroy();
  }
}
