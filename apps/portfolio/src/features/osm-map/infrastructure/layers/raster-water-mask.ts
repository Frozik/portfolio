import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';

export const RASTER_WATER_MASK_FORMAT: GPUTextureFormat = 'r8unorm';
const SINGLE_SAMPLE = 1;

/**
 * Where the raster map shows open water, one value per pixel of the canvas.
 * The ground layer writes it beside the picture; the water layer draws only
 * where it is set, so whatever the raster painted over the water — bridges,
 * piers, ferry lines, the rivers' names — stays on top.
 */
export type RasterWaterMask = DepthTextureManager;

export function createRasterWaterMask(): RasterWaterMask {
  return createDepthTextureManager(
    SINGLE_SAMPLE,
    RASTER_WATER_MASK_FORMAT,
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
}
