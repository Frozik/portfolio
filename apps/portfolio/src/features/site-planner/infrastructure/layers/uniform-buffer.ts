import type { StructuredView } from 'webgpu-utils';

import { UNIFORM_ALIGNMENT_BYTES } from '../render-constants';

/** A uniform buffer sized to a structured view, padded to the alignment the device demands. */
export function createUniformBuffer(device: GPUDevice, view: StructuredView): GPUBuffer {
  return device.createBuffer({
    size:
      Math.ceil(view.arrayBuffer.byteLength / UNIFORM_ALIGNMENT_BYTES) * UNIFORM_ALIGNMENT_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}
