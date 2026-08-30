import { isNil } from 'lodash-es';

import type { ColoredMesh, LitMesh } from '../../domain/geometry/lit-mesh';

/**
 * One mesh as the GPU holds it: its vertex buffers in the order the pipeline
 * declares them, and the indices that join them into triangles. Meshes are
 * replaced whole rather than edited, so there is nothing to keep of the mesh a
 * buffer was filled from.
 */
export interface GpuMesh {
  readonly vertexBuffers: readonly GPUBuffer[];
  readonly indexBuffer: GPUBuffer;
  readonly indexCount: number;
}

export function createVertexBuffer(device: GPUDevice, data: Float32Array): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(buffer, 0, data);

  return buffer;
}

/** Uploads positions and normals; a mesh with no triangles occupies nothing. */
export function uploadLitMesh(device: GPUDevice, mesh: LitMesh | undefined): GpuMesh | undefined {
  if (isNil(mesh) || mesh.indices.length === 0) {
    return undefined;
  }

  return {
    vertexBuffers: [
      createVertexBuffer(device, mesh.positions),
      createVertexBuffer(device, mesh.normals),
    ],
    indexBuffer: createIndexBuffer(device, mesh.indices),
    indexCount: mesh.indices.length,
  };
}

/** As {@link uploadLitMesh}, with the per-vertex colours as a third buffer. */
export function uploadColoredMesh(
  device: GPUDevice,
  mesh: ColoredMesh | undefined
): GpuMesh | undefined {
  const uploaded = uploadLitMesh(device, mesh);

  if (isNil(uploaded) || isNil(mesh)) {
    return undefined;
  }

  return {
    ...uploaded,
    vertexBuffers: [...uploaded.vertexBuffers, createVertexBuffer(device, mesh.colors)],
  };
}

export function releaseGpuMesh(mesh: GpuMesh | undefined): void {
  if (isNil(mesh)) {
    return;
  }

  for (const buffer of mesh.vertexBuffers) {
    buffer.destroy();
  }

  mesh.indexBuffer.destroy();
}

/** Binds every buffer of the mesh, in the order the pipeline declares them. */
export function bindGpuMesh(pass: GPURenderPassEncoder, mesh: GpuMesh): void {
  mesh.vertexBuffers.forEach((buffer, slot) => pass.setVertexBuffer(slot, buffer));
  pass.setIndexBuffer(mesh.indexBuffer, 'uint32');
}

export function createIndexBuffer(device: GPUDevice, data: Uint32Array): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(buffer, 0, data);

  return buffer;
}
