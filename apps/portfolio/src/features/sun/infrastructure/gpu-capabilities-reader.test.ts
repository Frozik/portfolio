import { describe, expect, it } from 'vitest';

import { readGpuCapabilities } from './gpu-capabilities-reader';

/** Limits live on the prototype as getters, the way the browser's own object has them. */
class FakeLimits {
  get maxTextureDimension2D(): number {
    return 8192;
  }
  get maxBindGroups(): number {
    return 4;
  }
}
Object.defineProperty(FakeLimits.prototype, 'maxTextureDimension2D', { enumerable: true });
Object.defineProperty(FakeLimits.prototype, 'maxBindGroups', { enumerable: true });

function fakeAdapter(info: Record<string, unknown>): GPUAdapter {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a browser adapter cannot be constructed in a test
  return {
    info: { vendor: 'nvidia', architecture: 'turing', device: '0x1f08', description: '', ...info },
    features: new Set(['timestamp-query', 'depth-clip-control']),
    limits: new FakeLimits(),
  } as unknown as GPUAdapter;
}

describe('readGpuCapabilities', () => {
  it('reads who the adapter is, its features, and every limit off the prototype', () => {
    const capabilities = readGpuCapabilities(
      fakeAdapter({ isFallbackAdapter: false }),
      'bgra8unorm'
    );

    expect(capabilities).toEqual({
      vendor: 'nvidia',
      architecture: 'turing',
      device: '0x1f08',
      description: '',
      isFallback: false,
      canvasFormat: 'bgra8unorm',
      features: ['depth-clip-control', 'timestamp-query'],
      limits: [
        { name: 'maxBindGroups', value: 4 },
        { name: 'maxTextureDimension2D', value: 8192 },
      ],
    });
  });

  it('leaves software-or-not unknown on a browser whose adapter does not say', () => {
    expect(readGpuCapabilities(fakeAdapter({}), 'rgba8unorm').isFallback).toBeUndefined();
  });
});
