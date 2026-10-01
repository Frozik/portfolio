import { isNil } from 'lodash-es';

import type { GpuCapabilities, GpuFailure, GpuLimit } from '../domain/gpu-capabilities';

/** What the adapter reports, as plain data. */
export function readGpuCapabilities(adapter: GPUAdapter, canvasFormat: string): GpuCapabilities {
  const { info } = adapter;
  return {
    vendor: info.vendor,
    architecture: info.architecture,
    device: info.device,
    description: info.description,
    // Older browsers have no such field on the info; there the answer is unknown, not "hardware".
    isFallback: 'isFallbackAdapter' in info ? info.isFallbackAdapter : undefined,
    canvasFormat,
    features: [...adapter.features].sort(),
    limits: readLimits(adapter.limits),
  };
}

function readLimits(limits: GPUSupportedLimits): readonly GpuLimit[] {
  const read: GpuLimit[] = [];
  // The limits are getters on the prototype: `for…in` reaches them, `Object.keys` does not.
  for (const name in limits) {
    const value: unknown = Reflect.get(limits, name);
    if (typeof value === 'number') {
      read.push({ name, value });
    }
  }
  return read.sort((a, b) => a.name.localeCompare(b.name));
}

/** Walks the bring-up again to find the step WebGPU stops at. */
export async function diagnoseGpuFailure(error: unknown): Promise<GpuFailure> {
  if (isNil(navigator.gpu)) {
    return { reason: window.isSecureContext ? 'no-api' : 'insecure-context', detail: undefined };
  }
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (isNil(adapter)) {
    return { reason: 'no-adapter', detail: undefined };
  }
  return { reason: 'no-device', detail: error instanceof Error ? error.message : String(error) };
}
