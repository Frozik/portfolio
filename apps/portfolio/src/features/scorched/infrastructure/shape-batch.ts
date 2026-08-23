import { isNil } from 'lodash-es';

import type { ShapeInstanceList } from './shape-instances';
import { SHAPE_INSTANCE_BYTES, SHAPE_VERTEX_COUNT } from './shape-instances';
import type { ShapePipeline } from './shape-pipeline';

/**
 * One layer's slice of the shared shape pipeline: a storage buffer of instances plus the bind
 * group that reads it. The buffer is sized once from the layer's capacity and destroyed with it.
 */
export class ShapeBatch {
  private readonly instanceBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private instanceCount = 0;

  constructor(
    private readonly shapePipeline: ShapePipeline,
    capacity: number
  ) {
    this.instanceBuffer = shapePipeline.device.createBuffer({
      size: capacity * SHAPE_INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = shapePipeline.createBindGroup(this.instanceBuffer);
  }

  upload(instances: ShapeInstanceList): void {
    this.instanceCount = instances.instanceCount;

    if (this.instanceCount === 0) {
      return;
    }

    this.shapePipeline.device.queue.writeBuffer(
      this.instanceBuffer,
      0,
      instances.data.buffer,
      instances.data.byteOffset,
      this.instanceCount * SHAPE_INSTANCE_BYTES
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

    if (this.instanceCount > 0) {
      pass.setPipeline(this.shapePipeline.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(SHAPE_VERTEX_COUNT, this.instanceCount, 0, 0);
    }

    pass.end();
  }

  dispose(): void {
    this.instanceBuffer.destroy();
  }
}
