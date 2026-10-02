import type { IScaleFrame } from '../scale/scale';
import type { IChartFrame } from './chart-frame';

export const CROSSHAIR_EXTENSION = 'crosshair';

/** CSS pixels from the top-left corner of the chart. */
export interface IPointerPosition {
  readonly x: number;
  readonly y: number;
}

/** Everything is in device pixels, measured from the top-left corner of the canvas. */
export interface ICrosshair<TX> {
  /** Left edge of the vertical line and top edge of the horizontal one. */
  readonly lineLeft: number;
  readonly lineTop: number;
  readonly thickness: number;
  /** The lines are this thick for `centerArmLength` to each side of where they cross. */
  readonly centerThickness: number;
  readonly centerArmLength: number;
  readonly dashLength: number;
  readonly x: TX;
  readonly xLabel: string;
  /** The value under the pointer on the first scale of the pane it is over. */
  readonly value: number;
  readonly valueLabel: string;
  /** The same height read on every scale of that pane: each of them labels it in its own units. */
  readonly values: readonly ICrosshairValue[];
}

export interface ICrosshairValue {
  readonly scale: IScaleFrame;
  readonly value: number;
  readonly label: string;
}

export interface ICrosshairSlice<TX> {
  /** Where the pointer is over the chart, CSS pixels; none while it is away or a finger only pans. */
  readonly position: IPointerPosition | undefined;
  /** The crosshair under the pointer, or none while the pointer is outside the plot. */
  crosshairOf(frame: IChartFrame<TX>): ICrosshair<TX> | undefined;
  /** The position and value under the pointer, in the last frame drawn. */
  readonly point: { readonly x: TX; readonly value: number } | undefined;
}
