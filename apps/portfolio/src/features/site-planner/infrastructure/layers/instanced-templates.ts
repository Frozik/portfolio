import { isNil } from 'lodash-es';

import type { SceneTree } from '../../domain/terrain/place-trees';
import type { WorldPoint } from '../../domain/view/world-frame';
import type { GpuMesh } from './gpu-mesh';
import { bindGpuMesh, createVertexBuffer, releaseGpuMesh } from './gpu-mesh';
import { CAR_INSTANCE_FLOATS, TREE_INSTANCE_FLOATS } from './vertex-layouts';

/** The instances drawn from one template, grown as the planting does. */
export interface TemplateInstances {
  readonly buffer: GPUBuffer;
  readonly count: number;
}

/**
 * One low-polygon template per key — a species of tree, a catalogue row of
 * furniture — and the instance buffer of everything drawn from it.
 */
export class InstancedTemplates<TKey> {
  private readonly templates = new Map<TKey, GpuMesh>();
  private readonly instances = new Map<TKey, TemplateInstances>();

  setTemplate(key: TKey, template: GpuMesh | undefined): void {
    if (!isNil(template)) {
      this.templates.set(key, template);
    }
  }

  /** Replaces one key's instances whole; an emptied key gives its buffer back. */
  replace(device: GPUDevice, key: TKey, data: Float32Array, count: number): void {
    const instances = replaceInstances(device, this.instances.get(key), data, count);

    if (isNil(instances)) {
      this.instances.delete(key);
    } else {
      this.instances.set(key, instances);
    }
  }

  draw(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    let hasSetPipeline = false;

    for (const [key, template] of this.templates) {
      const instances = this.instances.get(key);

      if (isNil(instances) || instances.count === 0) {
        continue;
      }

      if (!hasSetPipeline) {
        pass.setPipeline(pipeline);
        hasSetPipeline = true;
      }

      bindGpuMesh(pass, template);
      pass.setVertexBuffer(template.vertexBuffers.length, instances.buffer);
      pass.drawIndexed(template.indexCount, instances.count);
    }
  }

  dispose(): void {
    for (const template of this.templates.values()) {
      releaseGpuMesh(template);
    }

    for (const instances of this.instances.values()) {
      instances.buffer.destroy();
    }

    this.templates.clear();
    this.instances.clear();
  }
}

/**
 * Puts the instance data of one template into the buffer that held the previous
 * batch. The buffer is reused while it is large enough, so planting a tree next
 * to an existing one costs a write and no allocation; a batch that has emptied
 * gives its buffer back.
 */
export function replaceInstances(
  device: GPUDevice,
  existing: TemplateInstances | undefined,
  data: Float32Array,
  count: number
): TemplateInstances | undefined {
  if (count === 0) {
    existing?.buffer.destroy();

    return undefined;
  }

  const canReuseBuffer = !isNil(existing) && existing.buffer.size >= data.byteLength;

  if (!canReuseBuffer) {
    existing?.buffer.destroy();

    return { buffer: createVertexBuffer(device, data), count };
  }

  device.queue.writeBuffer(existing.buffer, 0, data);

  return { buffer: existing.buffer, count };
}

export function buildTreeInstanceData(trees: readonly SceneTree[]): Float32Array {
  const data = new Float32Array(trees.length * TREE_INSTANCE_FLOATS);

  trees.forEach((tree, index) => {
    const offset = index * TREE_INSTANCE_FLOATS;
    const [x, y, z] = tree.position;

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = tree.crownRadius;
    data[offset + 4] = tree.height;
  });

  return data;
}

/** Cars and furniture share the layout: where it stands and how it is turned. */
export function buildTurnedInstanceData(
  objects: readonly { readonly position: WorldPoint; readonly rotationDegrees: number }[]
): Float32Array {
  const data = new Float32Array(objects.length * CAR_INSTANCE_FLOATS);

  objects.forEach((object, index) => {
    const offset = index * CAR_INSTANCE_FLOATS;
    const [x, y, z] = object.position;

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = object.rotationDegrees;
  });

  return data;
}
