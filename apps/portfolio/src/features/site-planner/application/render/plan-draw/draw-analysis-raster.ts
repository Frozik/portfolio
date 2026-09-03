import type { AnalysisRaster } from '../../../domain/terrain/analysis-raster';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';

/**
 * The raster ready to be painted. Turning the pixels into one is a job for the
 * render session — it owns the canvas the raster is drawn onto and keeps it for
 * as long as the analysis stands — so this module only ever receives the result.
 */
export type AnalysisRasterImage = ImageBitmap | OffscreenCanvas;

const HALF_TEXEL = 0.5;

/**
 * The analysis overlay, stretched over the ground it describes.
 *
 * Nearest sampling (`imageSmoothingEnabled = false`): one texel is one terrain
 * sample, the 3D overlay samples the very same raster with a nearest sampler,
 * and only an identical rule leaves the two views agreeing texel for texel.
 * Smoothing them both would agree just as well in principle, but a blurred
 * classification hides where a slope band actually begins.
 */
export function drawAnalysisRaster(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { raster, image }: { readonly raster: AnalysisRaster; readonly image: AnalysisRasterImage }
): void {
  const { widthTexels, heightTexels, cellSizeMeters, originMeters } = raster;
  const widthPx = widthTexels * cellSizeMeters * viewport.pixelsPerMeter;
  const heightPx = heightTexels * cellSizeMeters * viewport.pixelsPerMeter;

  if (!(widthPx > 0) || !(heightPx > 0)) {
    return;
  }

  // Texel (0, 0) is centred on the first grid sample, so the raster reaches half
  // a cell past the outermost samples on every side.
  const northWest = planToScreen(viewport, {
    x: originMeters.x - cellSizeMeters * HALF_TEXEL,
    y: originMeters.y + (heightTexels - HALF_TEXEL) * cellSizeMeters,
  });

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // The raster's rows run north from its origin while the canvas's run south
  // from its top: this flip is the only place the two orders meet.
  ctx.translate(northWest.x, northWest.y + heightPx);
  ctx.scale(1, -1);
  ctx.drawImage(image, 0, 0, widthPx, heightPx);
  ctx.restore();
}
