import {
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
} from './constants';

/** Raw (sub-pixel) plot rectangle in device pixels. */
export interface IPlotGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Single source of truth for plot geometry, so the GPU scissor rect
 * (floored, in `prepareDrawCommands`) and the 2D-canvas axis/grid geometry
 * (in the frame layout) derive from identical values and cannot drift.
 */
export function computePlotGeometry(
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number
): IPlotGeometry {
  return {
    left: AXIS_MARGIN_LEFT * devicePixelRatio,
    top: AXIS_MARGIN_TOP * devicePixelRatio,
    width: canvasWidth - (AXIS_MARGIN_LEFT + AXIS_MARGIN_RIGHT) * devicePixelRatio,
    height: canvasHeight - (AXIS_MARGIN_TOP + AXIS_MARGIN_BOTTOM) * devicePixelRatio,
  };
}
