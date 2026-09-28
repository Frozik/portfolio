import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_BG_PADDING_X,
  AXIS_LABEL_BG_PADDING_Y,
  TICK_LENGTH,
} from '../../domain/constants';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import type { ITextMeasurer } from '../../domain/text-measurer';

const LABEL_BG_RADIUS = 2;
const X_LABEL_GAP = 3;
const Y_LABEL_GAP = 4;

/** Device-pixel label styling, resolved once per paint from the current DPR. */
export interface IAxisLabelStyle {
  readonly font: string;
  readonly fontSize: number;
  readonly tickLength: number;
  readonly lineWidth: number;
  readonly bgPaddingX: number;
  readonly bgRadius: number;
  readonly boxHeight: number;
  readonly glyphCenterOffset: number;
  /** Vertical centre of the labels that sit above the time axis. */
  readonly timeLabelCenterY: number;
  /** Where the text of the labels beside the value axis starts. */
  readonly valueLabelTextX: number;
}

export interface ILabelPlacement {
  readonly boxLeft: number;
  readonly centerY: number;
  readonly textX: number;
  readonly textAlign: CanvasTextAlign;
}

export interface ILabelColors {
  readonly background: string;
  readonly text: string;
}

export function createAxisLabelStyle(
  layout: IChartFrameLayout,
  textMeasurer: ITextMeasurer
): IAxisLabelStyle {
  const { dpr, plotLeft, plotBottom } = layout;
  const fontSize = AXIS_FONT_SIZE * dpr;
  const font = `${fontSize}px ${AXIS_FONT_FAMILY}`;
  const tickLength = TICK_LENGTH * dpr;

  return {
    font,
    fontSize,
    tickLength,
    lineWidth: dpr,
    bgPaddingX: AXIS_LABEL_BG_PADDING_X * dpr,
    bgRadius: LABEL_BG_RADIUS * dpr,
    boxHeight: fontSize + AXIS_LABEL_BG_PADDING_Y * dpr * 2,
    glyphCenterOffset: textMeasurer.getGlyphMetrics(font).centerOffset,
    timeLabelCenterY: plotBottom - tickLength - X_LABEL_GAP * dpr - fontSize / 2,
    valueLabelTextX: plotLeft + tickLength + Y_LABEL_GAP * dpr,
  };
}

/** A label on its rounded background box; expects `ctx.font` to be `style.font`. */
export function drawAxisLabel(
  ctx: CanvasRenderingContext2D,
  style: IAxisLabelStyle,
  label: { readonly text: string; readonly textWidth: number; readonly placement: ILabelPlacement },
  colors: ILabelColors
): void {
  const { text, textWidth, placement } = label;

  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.roundRect(
    placement.boxLeft,
    placement.centerY - style.boxHeight / 2,
    textWidth + style.bgPaddingX * 2,
    style.boxHeight,
    style.bgRadius
  );
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.textAlign = placement.textAlign;
  ctx.fillText(text, placement.textX, placement.centerY + style.glyphCenterOffset);
}
