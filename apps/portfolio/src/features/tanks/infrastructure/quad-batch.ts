import { isNil } from 'lodash-es';

import type { QuadInstanceList } from './quad-instances';
import { QUAD_INSTANCE_BYTES, QUAD_VERTEX_COUNT } from './quad-instances';
import type { QuadPipeline } from './quad-pipeline';

export class QuadBatch {
  private instanceBuffer: GPUBuffer | undefined;
  private bindGroup: GPUBindGroup | undefined;
  private bufferCapacity = 0;
  private instanceCount = 0;

  constructor(private readonly quadPipeline: QuadPipeline) {}

  upload(instances: QuadInstanceList): void {
    this.instanceCount = instances.instanceCount;

    if (this.instanceCount === 0) {
      return;
    }

    this.ensureCapacity(this.instanceCount);

    if (isNil(this.instanceBuffer)) {
      return;
    }

    this.quadPipeline.device.queue.writeBuffer(
      this.instanceBuffer,
      0,
      instances.data.buffer,
      instances.data.byteOffset,
      this.instanceCount * QUAD_INSTANCE_BYTES
    );
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, clearValue?: GPUColor): void {
    const isClearing = !isNil(clearValue);

    if (this.instanceCount === 0 && !isClearing) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          loadOp: isClearing ? 'clear' : 'load',
          clearValue,
          storeOp: 'store',
        },
      ],
    });

    if (this.instanceCount > 0 && !isNil(this.bindGroup)) {
      pass.setPipeline(this.quadPipeline.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(QUAD_VERTEX_COUNT, this.instanceCount, 0, 0);
    }

    pass.end();
  }

  dispose(): void {
    this.instanceBuffer?.destroy();
    this.instanceBuffer = undefined;
    this.bindGroup = undefined;
    this.bufferCapacity = 0;
  }

  private ensureCapacity(instanceCount: number): void {
    if (instanceCount <= this.bufferCapacity) {
      return;
    }

    this.instanceBuffer?.destroy();
    this.bufferCapacity = instanceCount;
    this.instanceBuffer = this.quadPipeline.device.createBuffer({
      size: instanceCount * QUAD_INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = this.quadPipeline.createBindGroup(this.instanceBuffer);
  }
}
