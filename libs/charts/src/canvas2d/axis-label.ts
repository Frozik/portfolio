import type { IChartFrame } from '../core/frame/chart-frame';
import type { IScaleFrame } from '../core/scale/scale';
import { scaleLineX } from '../core/scale/scale-strip';
import type { TColor } from '../core/series/color';
import { cssOf } from '../core/series/color';
import type { ITextMeasurer } from './text-measurer';

const TICK_LENGTH = 5;
const LABEL_PADDING_X = 3;
const LABEL_PADDING_Y = 2;
const LABEL_RADIUS = 2;
const X_LABEL_GAP = 3;
const VALUE_LABEL_GAP = 4;

/** Device-pixel label styling, resolved once per paint from the frame. */
export interface IAxisLabelStyle {
  readonly font: string;
  readonly tickLength: number;
  readonly lineWidth: number;
  readonly paddingX: number;
  readonly radius: number;
  readonly boxHeight: number;
  readonly glyphCenterOffset: number;
  /** Vertical centre of the labels that sit above the X axis. */
  readonly xLabelCenterY: number;
  /** Room between a value scale's tick mark and its label. */
  readonly valueLabelGap: number;
}

export interface ILabelPlacement {
  readonly boxLeft: number;
  readonly centerY: number;
  readonly textX: number;
  readonly textAlign: CanvasTextAlign;
}

export interface ILabelColors {
  readonly background: TColor;
  readonly text: TColor;
}

export function axisLabelStyleOf(
  frame: IChartFrame<unknown>,
  text: ITextMeasurer
): IAxisLabelStyle {
  const { plot, theme } = frame;
  const dpr = frame.size.devicePixelRatio;
  const fontSize = theme.font.size * dpr;
  const font = `${fontSize}px ${theme.font.family}`;
  const tickLength = TICK_LENGTH * dpr;
  return {
    font,
    tickLength,
    lineWidth: dpr,
    paddingX: LABEL_PADDING_X * dpr,
    radius: LABEL_RADIUS * dpr,
    boxHeight: fontSize + LABEL_PADDING_Y * dpr * 2,
    glyphCenterOffset: text.getGlyphMetrics(font).centerOffset,
    xLabelCenterY: plot.bottom - tickLength - X_LABEL_GAP * dpr - fontSize / 2,
    valueLabelGap: VALUE_LABEL_GAP * dpr,
  };
}

/** A label of a value scale at a height: beside the scale's line, towards the plot. */
export function scaleLabelPlacement(
  frame: IChartFrame<unknown>,
  scale: IScaleFrame,
  style: IAxisLabelStyle,
  textWidth: number,
  centerY: number
): ILabelPlacement {
  const lineX = scaleLineX(frame, scale);
  const reach = style.tickLength + style.valueLabelGap;
  if (scale.side === 'left') {
    const textX = lineX + reach;
    return { boxLeft: textX - style.paddingX, centerY, textX, textAlign: 'start' };
  }
  const textX = lineX - reach;
  return { boxLeft: textX - textWidth - style.paddingX, centerY, textX, textAlign: 'end' };
}

/** A label on its rounded background box; expects `context.font` to be `style.font`. */
export function drawAxisLabel(
  context: CanvasRenderingContext2D,
  style: IAxisLabelStyle,
  label: { readonly text: string; readonly textWidth: number; readonly placement: ILabelPlacement },
  colors: ILabelColors
): void {
  const { text, textWidth, placement } = label;
  context.fillStyle = cssOf(colors.background);
  context.beginPath();
  context.roundRect(
    placement.boxLeft,
    placement.centerY - style.boxHeight / 2,
    textWidth + style.paddingX * 2,
    style.boxHeight,
    style.radius
  );
  context.fill();

  context.fillStyle = cssOf(colors.text);
  context.textAlign = placement.textAlign;
  context.fillText(text, placement.textX, placement.centerY + style.glyphCenterOffset);
}
