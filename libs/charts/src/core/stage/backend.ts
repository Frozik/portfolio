import type { IChartFrame } from '../frame/chart-frame';

/** Named bands a surface draws in, bottom first (§6.2). */
export const PAINT_BAND = {
  grid: 100,
  series: 200,
  annotation: 300,
  axes: 400,
  crosshair: 500,
} as const;

/**
 * Something an extension draws on one backend; the backend types the painter,
 * the kernel only carries it. Contributions sharing an id are the same thing
 * drawn by different backends: a stage uses the one whose backend is lowest
 * in its stack (§6.2).
 */
export interface IPaintContribution {
  readonly id: string;
  readonly backend: string;
  readonly band: number;
  readonly painter: unknown;
}

export interface ISurfaceRole {
  /** The surface is the bottom of the chart's stack: it paints the background and the series. */
  readonly drawsSeries: boolean;
}

export interface ISurface {
  paint(frame: IChartFrame<unknown>, now: number): void;
  dispose(): void;
}

/** A way of drawing and the resources every chart drawn that way shares (§6.1). */
export interface IRenderBackend {
  readonly id: string;
  /** Settles with the reason if the backend can no longer draw: a lost GPU device. */
  readonly lost?: Promise<string>;
  createSurface(
    canvas: unknown,
    contributions: readonly IPaintContribution[],
    role: ISurfaceRole
  ): ISurface;
  beginFrame(): void;
  endFrame(): void;
  dispose(): void;
}

/**
 * The frame as the painter's own chart built it. A backend carries frames with
 * the X type erased; a painter is only ever handed the frames of the chart it
 * was made for, so the type it was made with is the frame's.
 */
export function ownFrame<TX>(frame: IChartFrame<unknown>): IChartFrame<TX> {
  return frame as IChartFrame<TX>;
}
