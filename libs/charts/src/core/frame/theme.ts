import type { TColor } from '../series/color';

export interface IInsets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Every colour and size a chart is drawn with; extensions and style processors read their tokens from it (§8). */
export interface IChartTheme {
  readonly background: TColor;
  readonly grid: TColor;
  readonly axisLine: TColor;
  readonly label: { readonly text: TColor; readonly background: TColor };
  readonly crosshair: {
    readonly line: TColor;
    readonly center: TColor;
    readonly labelText: TColor;
    readonly labelBackground: TColor;
  };
  readonly font: { readonly family: string; readonly size: number };
  /** The margin kept round the plot, CSS pixels. */
  readonly margin: IInsets;
  readonly candle: { readonly up: TColor; readonly down: TColor; readonly stroke: TColor };
  readonly loading: { readonly light: TColor; readonly dark: TColor; readonly failed: TColor };
}

export const NO_INSETS: IInsets = { left: 0, top: 0, right: 0, bottom: 0 };

export function addInsets(first: IInsets, second: IInsets): IInsets {
  return {
    left: first.left + second.left,
    top: first.top + second.top,
    right: first.right + second.right,
    bottom: first.bottom + second.bottom,
  };
}
