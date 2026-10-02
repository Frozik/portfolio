import { areaCanvasPainter } from '../../canvas2d/marks/area/painter';
import { candleCanvasPainter } from '../../canvas2d/marks/candle/painter';
import { lineCanvasPainter } from '../../canvas2d/marks/line/painter';
import { markerCanvasPainter } from '../../canvas2d/marks/marker/painter';
import { CANVAS2D_BACKEND } from '../../canvas2d/painter';
import { withPainter } from '../../core/series/mark';
import { area as gpuArea } from '../../webgpu/marks/area/area';
import { candle as gpuCandle } from '../../webgpu/marks/candle/candle';
import { line as gpuLine } from '../../webgpu/marks/line/line';
import { marker as gpuMarker } from '../../webgpu/marks/marker/marker';

/**
 * The marks with a painter for every backend: a series styled with them is
 * drawn by whichever backend is the bottom of the stage it is mounted on.
 */
export const line = withPainter(gpuLine, CANVAS2D_BACKEND, lineCanvasPainter);
export const area = withPainter(gpuArea, CANVAS2D_BACKEND, areaCanvasPainter);
export const marker = withPainter(gpuMarker, CANVAS2D_BACKEND, markerCanvasPainter);
export const candle = withPainter(gpuCandle, CANVAS2D_BACKEND, candleCanvasPainter);
