import { describe, expect, it, vi } from 'vitest';

import { RenderTargetPool } from './render-target-pool';

function createMockDevice(): GPUDevice {
  return {
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => ({
      width: (descriptor.size as number[])[0],
      height: (descriptor.size as number[])[1],
      format: descriptor.format,
      usage: descriptor.usage,
      destroy: vi.fn(),
      createView: vi.fn(),
    })),
  } as unknown as GPUDevice;
}

const TEST_FORMAT = 'bgra8unorm' as GPUTextureFormat;
const EXPECTED_USAGE = 0x10 | 0x01; // RENDER_ATTACHMENT | COPY_SRC

describe('RenderTargetPool', () => {
  it('should create a new texture on first acquire', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    const texture = pool.acquire(device, 800, 600, TEST_FORMAT);

    expect(device.createTexture).toHaveBeenCalledOnce();
    expect(device.createTexture).toHaveBeenCalledWith({
      size: [800, 600],
      format: TEST_FORMAT,
      usage: EXPECTED_USAGE,
    });
    expect(texture.width).toBe(800);
    expect(texture.height).toBe(600);
  });

  it('should reuse a released texture with matching dimensions', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    const texture = pool.acquire(device, 800, 600, TEST_FORMAT);
    pool.release(texture);

    const reused = pool.acquire(device, 800, 600, TEST_FORMAT);

    // Only one createTexture call — the second acquire reused the released texture
    expect(device.createTexture).toHaveBeenCalledOnce();
    expect(reused).toBe(texture);
  });

  it('should create a new texture when released texture has different dimensions', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    const small = pool.acquire(device, 400, 300, TEST_FORMAT);
    pool.release(small);

    const large = pool.acquire(device, 800, 600, TEST_FORMAT);

    expect(device.createTexture).toHaveBeenCalledTimes(2);
    expect(large).not.toBe(small);
    expect(large.width).toBe(800);
    expect(large.height).toBe(600);
  });

  it('should destroy all textures on dispose', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    const textureA = pool.acquire(device, 800, 600, TEST_FORMAT);
    const textureB = pool.acquire(device, 400, 300, TEST_FORMAT);
    pool.release(textureA);
    pool.release(textureB);

    pool.dispose();

    expect(textureA.destroy).toHaveBeenCalledOnce();
    expect(textureB.destroy).toHaveBeenCalledOnce();
  });

  it('should not reuse textures after dispose', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    const texture = pool.acquire(device, 800, 600, TEST_FORMAT);
    pool.release(texture);
    pool.dispose();

    const fresh = pool.acquire(device, 800, 600, TEST_FORMAT);

    expect(device.createTexture).toHaveBeenCalledTimes(2);
    expect(fresh).not.toBe(texture);
  });

  it('should handle acquire-release-acquire cycle for same-size charts', () => {
    const pool = new RenderTargetPool();
    const device = createMockDevice();

    // Simulates rendering 4 charts of the same size in a frame:
    // acquire → render → release → acquire (reuse) → render → release → ...
    const firstTexture = pool.acquire(device, 800, 600, TEST_FORMAT);
    pool.release(firstTexture);

    const secondTexture = pool.acquire(device, 800, 600, TEST_FORMAT);
    pool.release(secondTexture);

    const thirdTexture = pool.acquire(device, 800, 600, TEST_FORMAT);
    pool.release(thirdTexture);

    // All should be the same texture object — only 1 GPU allocation
    expect(device.createTexture).toHaveBeenCalledOnce();
    expect(secondTexture).toBe(firstTexture);
    expect(thirdTexture).toBe(firstTexture);
  });
});
