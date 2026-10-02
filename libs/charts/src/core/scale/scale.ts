import type { IPlotRect } from '../frame/plot-rect';
import type { TColor } from '../series/color';

/** How values are spread along the axis: evenly, or by their order of magnitude. */
export type TScaleKind = 'linear' | 'log';
export type TScaleSide = 'left' | 'right';
/** What the labels of a scale say: the value itself, or its change from the first value in view, in per cent. */
export type TScaleLabels = 'value' | 'percent';

export const MAIN_PANE = 'main';
export const MAIN_SCALE = 'main';

/** A horizontal band of the chart with its own value scales; panes share the X axis and are stacked top to bottom. */
export interface IPaneOptions {
  readonly id: string;
  /** The share of the chart's height the pane takes, relative to the others; one by default. */
  readonly weight?: number;
}

/** A value axis. A chart may have several: each series is measured against the one it names. */
export interface IScaleOptions {
  readonly id: string;
  /** The pane the scale belongs to; the first pane by default. */
  readonly pane?: string;
  readonly side?: TScaleSide;
  readonly kind?: TScaleKind;
  readonly labels?: TScaleLabels;
  /** The lower end of the scale, fixed: nothing fits it to the data. Without it the end follows the data. */
  readonly min?: number;
  /** The upper end of the scale, fixed. Without it the end follows the data. */
  readonly max?: number;
  /** Room left beyond the data at each end that follows it, as a share of the data's height; the autoscale's own when not given. */
  readonly padding?: number;
  /** The scale runs downwards: its minimum at the top. */
  readonly inverted?: boolean;
  /** Whether the line, the ticks and the labels of the scale are drawn; the series against it are drawn either way. Shown by default. */
  readonly visible?: boolean;
  /** What the scale measures — a unit, a currency — written at its top end. */
  readonly title?: string;
  /** How a value of the scale is written, on ticks and under the crosshair; round numbers by default. */
  readonly format?: (value: number) => string;
  /** The colour of the scale's labels, to tell it from its neighbours; the theme's by default. */
  readonly color?: TColor;
}

/** The vertical stretch of the canvas a scale spreads its range over, device pixels. */
export interface IScaleArea {
  readonly top: number;
  readonly height: number;
}

/** A scale as a frame shows it: its range this frame and where on the canvas it lies. */
export interface IScaleFrame {
  readonly id: string;
  readonly paneId: string;
  readonly side: TScaleSide;
  /** Its place among the visible scales on its side of its pane: nought is next to the plot. */
  readonly order: number;
  readonly kind: TScaleKind;
  readonly labels: TScaleLabels;
  readonly min: number;
  readonly max: number;
  readonly inverted: boolean;
  readonly visible: boolean;
  readonly title: string | undefined;
  readonly format: ((value: number) => string) | undefined;
  /** The value per cent labels are counted from: the first one in view. None while there is none, or for value labels. */
  readonly base: number | undefined;
  readonly color: TColor | undefined;
  readonly area: IScaleArea;
  /** The plot of the scale's pane: what is drawn against the scale is clipped to it. */
  readonly plot: IPlotRect;
}

export interface IPaneFrame {
  readonly id: string;
  readonly plot: IPlotRect;
  /** The scales of the pane; the first is the one its grid follows. */
  readonly scales: readonly IScaleFrame[];
}
