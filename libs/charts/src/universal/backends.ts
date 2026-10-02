import { isNil } from 'lodash-es';

import type { ICanvas2dOptions } from '../canvas2d/backend';
import { canvas2d } from '../canvas2d/backend';
import type { IRenderBackend } from '../core/stage/backend';
import type { IWebGpuBackendOptions } from '../webgpu/backend';
import { webgpu } from '../webgpu/backend';

export interface IAvailableBackendsOptions {
  readonly webgpu?: IWebGpuBackendOptions;
  readonly canvas2d?: ICanvas2dOptions;
  /** WebGPU is there but could not be started: the charts will be drawn on the 2D canvas. */
  readonly onFallback?: (error: unknown) => void;
}

/**
 * The best stack the device can run: WebGPU under a 2D canvas overlay where
 * a GPU device can be had, the 2D canvas alone where it cannot — an old
 * phone, a browser without WebGPU, a blocklisted driver. Charts built from
 * the universal marks and extensions are drawn by either.
 */
export async function availableBackends(
  options: IAvailableBackendsOptions = {}
): Promise<readonly IRenderBackend[]> {
  const overlay = canvas2d(options.canvas2d);
  if (isNil(navigator.gpu)) {
    return [overlay];
  }
  try {
    return [await webgpu(options.webgpu), overlay];
  } catch (error) {
    options.onFallback?.(error);
    return [overlay];
  }
}
