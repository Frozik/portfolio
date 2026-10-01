import { describe, expect, it } from 'vitest';

import type { GpuCapabilities, GpuStatus, WebGlInfo } from './gpu-capabilities';
import { accelerationOf, featureSupportOf, GPU_PENDING, keyLimitsOf } from './gpu-capabilities';

const CARD: GpuCapabilities = {
  vendor: 'apple',
  architecture: 'metal-3',
  device: '',
  description: '',
  isFallback: false,
  canvasFormat: 'bgra8unorm',
  features: ['timestamp-query', 'chromium-experimental-thing', 'shader-f16'],
  limits: [
    { name: 'maxBindGroups', value: 4 },
    { name: 'maxSomethingObscure', value: 1 },
    { name: 'maxTextureDimension2D', value: 16384 },
  ],
};

const WEBGL: WebGlInfo = {
  renderer: 'ANGLE (Apple M1 Pro)',
  vendor: 'Google Inc. (Apple)',
  isSoftware: false,
  maxTextureSize: 16384,
};

const ready = (capabilities: GpuCapabilities): GpuStatus => ({ kind: 'ready', capabilities });

describe('what the card can do', () => {
  it('lists every feature of the specification with whether the card has it, then what it offers beyond', () => {
    const features = featureSupportOf(CARD);

    expect(features.find(feature => feature.name === 'shader-f16')?.isSupported).toBe(true);
    expect(features.find(feature => feature.name === 'texture-compression-bc')?.isSupported).toBe(
      false
    );
    expect(features.at(-1)).toEqual({ name: 'chromium-experimental-thing', isSupported: true });
  });

  it('shows the limits a renderer runs into first, the widest texture leading', () => {
    expect(keyLimitsOf(CARD).map(limit => limit.name)).toEqual([
      'maxTextureDimension2D',
      'maxBindGroups',
    ]);
  });
});

describe('hardware acceleration', () => {
  it('is what the WebGPU adapter says of itself', () => {
    expect(accelerationOf(ready(CARD), undefined)).toBe('hardware');
    expect(accelerationOf(ready({ ...CARD, isFallback: true }), WEBGL)).toBe('software');
  });

  it('falls back on WebGL where WebGPU has no say', () => {
    const silent = ready({ ...CARD, isFallback: undefined });

    expect(accelerationOf(silent, WEBGL)).toBe('hardware');
    expect(accelerationOf(GPU_PENDING, { ...WEBGL, isSoftware: true })).toBe('software');
    expect(accelerationOf(GPU_PENDING, undefined)).toBe('unknown');
  });
});
