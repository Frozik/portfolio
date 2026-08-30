import { isNil } from 'lodash-es';

import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';

/** A data URL needs no element to decode through — a blob is all `createImageBitmap` wants. */
export async function decodeImageDataUrl(dataUrl: string): Promise<ImageBitmap> {
  const response = await fetch(dataUrl);

  return createImageBitmap(await response.blob());
}

/**
 * The raster's pixels on a canvas of its own, at one texel per pixel. The frame
 * then stretches that canvas over the plan with `drawImage`, which scales it
 * properly; writing the pixels straight onto the plan with `putImageData` would
 * ignore both the viewport transform and the scale.
 *
 * Synchronous on purpose — `createImageBitmap` would land a frame later, and an
 * overlay that lags a zoom by a frame is worse than one drawn slightly slower.
 */
export function createRasterImage(raster: AnalysisRaster): OffscreenCanvas | undefined {
  const { widthTexels, heightTexels, pixels } = raster;

  if (widthTexels <= 0 || heightTexels <= 0) {
    return undefined;
  }

  const canvas = new OffscreenCanvas(widthTexels, heightTexels);
  const rasterContext = canvas.getContext('2d');

  if (isNil(rasterContext)) {
    return undefined;
  }

  rasterContext.putImageData(new ImageData(pixels, widthTexels, heightTexels), 0, 0);

  return canvas;
}
