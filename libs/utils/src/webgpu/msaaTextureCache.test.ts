import { describe, expect, it, vi } from 'vitest';

import { MsaaTextureCache } from './msaaTextureCache';

interface IMockTexture {
  readonly destroy: ReturnType<typeof vi.fn>;
}

function createMockDevice(): { readonly device: GPUDevice; readonly textures: IMockTexture[] } {
  const textures: IMockTexture[] = [];
  const device = {
    createTexture: vi.fn(() => {
      const texture = { destroy: vi.fn(), createView: vi.fn(() => ({})) };
      textures.push(texture);
      return texture;
    }),
  } as unknown as GPUDevice;
  return { device, textures };
}

const TEST_FORMAT: GPUTextureFormat = 'bgra8unorm';
const SAMPLE_COUNT = 4;
const RENDER_ATTACHMENT = 0x10;

vi.stubGlobal('GPUTextureUsage', { RENDER_ATTACHMENT });

describe('MsaaTextureCache', () => {
  it('allocates a multisampled render attachment of the requested size', () => {
    const { device } = createMockDevice();
    const cache = new MsaaTextureCache(device, TEST_FORMAT, SAMPLE_COUNT);

    cache.acquireView(800, 600);

    expect(device.createTexture).toHaveBeenCalledWith({
      size: [800, 600],
      format: TEST_FORMAT,
      sampleCount: SAMPLE_COUNT,
      usage: RENDER_ATTACHMENT,
    });
  });

  it('shares one texture between every target of the same size', () => {
    const { device } = createMockDevice();
    const cache = new MsaaTextureCache(device, TEST_FORMAT, SAMPLE_COUNT);

    const first = cache.acquireView(800, 600);
    const second = cache.acquireView(800, 600);

    expect(second).toBe(first);
    expect(device.createTexture).toHaveBeenCalledOnce();
  });

  it('keeps targets of different sizes from evicting each other', () => {
    const { device, textures } = createMockDevice();
    const cache = new MsaaTextureCache(device, TEST_FORMAT, SAMPLE_COUNT);

    const large = cache.acquireView(800, 600);
    const small = cache.acquireView(400, 300);
    cache.sweepUnused();

    expect(cache.acquireView(800, 600)).toBe(large);
    expect(cache.acquireView(400, 300)).toBe(small);
    expect(device.createTexture).toHaveBeenCalledTimes(2);
    expect(textures.every(texture => texture.destroy.mock.calls.length === 0)).toBe(true);
  });

  it('destroys a texture nobody acquired since the previous sweep', () => {
    const { device, textures } = createMockDevice();
    const cache = new MsaaTextureCache(device, TEST_FORMAT, SAMPLE_COUNT);

    const beforeResize = cache.acquireView(400, 300);
    cache.sweepUnused();
    cache.acquireView(800, 600);
    cache.sweepUnused();

    expect(textures[0].destroy).toHaveBeenCalledOnce();
    expect(textures[1].destroy).not.toHaveBeenCalled();
    expect(cache.acquireView(400, 300)).not.toBe(beforeResize);
  });

  it('destroys every texture on dispose', () => {
    const { device, textures } = createMockDevice();
    const cache = new MsaaTextureCache(device, TEST_FORMAT, SAMPLE_COUNT);

    cache.acquireView(800, 600);
    cache.acquireView(400, 300);
    cache.dispose();

    expect(textures.map(texture => texture.destroy.mock.calls.length)).toEqual([1, 1]);
  });
});
