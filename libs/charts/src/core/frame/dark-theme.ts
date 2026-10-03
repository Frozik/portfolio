import { rgba } from '../series/color';
import type { IChartTheme } from './theme';

const MARGIN_PX = 10;
const GRID_SHADE = 0x44 / 0xff;
const AXIS_SHADE = 0xaa / 0xff;
const LABEL_SHADE = 0xcc / 0xff;
const LABEL_BACKGROUND_SHADE = 50 / 255;
const CANDLE_STROKE_SHADE = 0.55;

/** The default look: light marks on a near-black scene. */
export const darkTheme: IChartTheme = {
  background: rgba(0x07 / 0xff, 0x09 / 0xff, 0x0c / 0xff),
  grid: rgba(GRID_SHADE, GRID_SHADE, GRID_SHADE),
  // Amber, not a grey: a cut must stand out from the grid lines it runs among.
  cut: rgba(0xe6 / 0xff, 0xa8 / 0xff, 0x3c / 0xff),
  axisLine: rgba(AXIS_SHADE, AXIS_SHADE, AXIS_SHADE),
  label: {
    text: rgba(LABEL_SHADE, LABEL_SHADE, LABEL_SHADE),
    background: rgba(LABEL_BACKGROUND_SHADE, LABEL_BACKGROUND_SHADE, LABEL_BACKGROUND_SHADE, 0.75),
  },
  crosshair: {
    line: rgba(205 / 255, 215 / 255, 235 / 255, 0.7),
    center: rgba(1, 1, 1),
    labelText: rgba(0xee / 0xff, 0xf3 / 0xff, 1),
    labelBackground: rgba(0x16 / 0xff, 0x33 / 0xff, 0x7a / 0xff),
  },
  font: { family: 'monospace', size: 11 },
  margin: { left: MARGIN_PX, top: MARGIN_PX, right: MARGIN_PX, bottom: MARGIN_PX },
  candle: {
    up: rgba(0.2, 0.8, 0.3),
    down: rgba(0.9, 0.2, 0.2),
    stroke: rgba(CANDLE_STROKE_SHADE, CANDLE_STROKE_SHADE, CANDLE_STROKE_SHADE),
  },
  loading: {
    light: rgba(100 / 255, 160 / 255, 1, 0.6),
    dark: rgba(30 / 255, 80 / 255, 180 / 255, 0.8),
    failed: rgba(0.9, 0.25, 0.2, 0.8),
  },
};
