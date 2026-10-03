import type { IChartTheme } from '../core/frame/theme';
import { rgba } from '../core/series/color';

const MARGIN_PX = 10;
const GRID_SHADE = 0.82;
const AXIS_SHADE = 0.4;
const LABEL_SHADE = 0.2;
const CANDLE_STROKE_SHADE = 0.35;

/** Dark marks on a white scene. */
export const lightTheme: IChartTheme = {
  background: rgba(1, 1, 1),
  grid: rgba(GRID_SHADE, GRID_SHADE, GRID_SHADE),
  cut: rgba(0xc0 / 0xff, 0x70 / 0xff, 0x10 / 0xff),
  axisLine: rgba(AXIS_SHADE, AXIS_SHADE, AXIS_SHADE),
  label: {
    text: rgba(LABEL_SHADE, LABEL_SHADE, LABEL_SHADE),
    background: rgba(0.94, 0.94, 0.94, 0.85),
  },
  crosshair: {
    line: rgba(0.2, 0.25, 0.35, 0.7),
    center: rgba(0, 0, 0),
    labelText: rgba(1, 1, 1),
    labelBackground: rgba(0.15, 0.32, 0.72),
  },
  font: { family: 'monospace', size: 11 },
  margin: { left: MARGIN_PX, top: MARGIN_PX, right: MARGIN_PX, bottom: MARGIN_PX },
  candle: {
    up: rgba(0.1, 0.62, 0.25),
    down: rgba(0.85, 0.15, 0.15),
    stroke: rgba(CANDLE_STROKE_SHADE, CANDLE_STROKE_SHADE, CANDLE_STROKE_SHADE),
  },
  loading: {
    light: rgba(0.39, 0.63, 1, 0.6),
    dark: rgba(0.12, 0.31, 0.71, 0.8),
    failed: rgba(0.85, 0.2, 0.2, 0.8),
  },
};
