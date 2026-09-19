import { describe, expect, it, vi } from 'vitest';

import { DynamicVertexBuffer } from './dynamic-vertex-buffer';
import type { MeshData } from './mesh-writer';

const STRIDE_BYTES = 12;
const INITIAL_VERTICES = 4;
const USAGE = 0x28;

function createMockDevice(): GPUDevice {
  return {
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => ({
      size: descriptor.size,
      destroy: vi.fn(),
    })),
    queue: { writeBuffer: vi.fn() },
  } as unknown as GPUDevice;
}

const mesh = (vertexCount: number): MeshData => ({
  vertexData: new ArrayBuffer(vertexCount * STRIDE_BYTES),
  vertexCount,
});

const create = (device: GPUDevice) =>
  new DynamicVertexBuffer({
    device,
    strideBytes: STRIDE_BYTES,
    initialVertices: INITIAL_VERTICES,
    usage: USAGE,
  });

describe('DynamicVertexBuffer', () => {
  it('keeps every vertex of a frame that outgrows the buffer, instead of dropping its tail', () => {
    const device = createMockDevice();
    const buffer = create(device);

    const drawn = buffer.write(mesh(INITIAL_VERTICES * 3));

    expect(drawn).toBe(INITIAL_VERTICES * 3);
    expect(device.queue.writeBuffer).toHaveBeenCalledWith(
      buffer.buffer,
      0,
      expect.anything(),
      0,
      INITIAL_VERTICES * 3 * STRIDE_BYTES
    );
  });

  it('grows to hold the biggest frame so far and releases the buffer it outgrew', () => {
    const device = createMockDevice();
    const buffer = create(device);
    const outgrown = buffer.buffer;

    buffer.write(mesh(INITIAL_VERTICES * 3));

    expect(outgrown.destroy).toHaveBeenCalledOnce();
    expect(buffer.buffer).not.toBe(outgrown);
    expect(buffer.buffer.size).toBeGreaterThanOrEqual(INITIAL_VERTICES * 3 * STRIDE_BYTES);
  });

  it('allocates once for frames that fit, and once more the first time one does not', () => {
    const device = createMockDevice();
    const buffer = create(device);

    buffer.write(mesh(INITIAL_VERTICES));
    const original = buffer.buffer;
    buffer.write(mesh(INITIAL_VERTICES * 3));
    const grown = buffer.buffer;
    buffer.write(mesh(INITIAL_VERTICES));

    expect(grown).not.toBe(original);
    expect(buffer.buffer).toBe(grown);
    expect(device.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('draws nothing and touches no memory for an empty frame', () => {
    const device = createMockDevice();
    const buffer = create(device);

    expect(buffer.write(mesh(0))).toBe(0);
    expect(device.queue.writeBuffer).not.toHaveBeenCalled();
  });
});
