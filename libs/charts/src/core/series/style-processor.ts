import { assert } from '@frozik/utils/assert/assert';

import type { IChartTheme } from '../frame/theme';
import type { TColor } from './color';
import type { IMark } from './mark';
import { isRunOf } from './point-run';
import type { TRun } from './point-run';
import type { TShape } from './shape';

/** A colour and a size: one for the whole run, or one per element. */
export interface IPaint {
  readonly color: TColor | Uint32Array;
  /** CSS pixels. A stroke of size nought is no stroke. */
  readonly size: number | Float32Array;
}

/** A mark and its parameters: how a line joins its points, which figure a marker is. */
export interface IMarkUse {
  readonly mark: IMark;
  readonly options?: unknown;
}

export interface IStyle {
  /** The marks that draw the run, bottom first; usually one. */
  readonly marks: readonly IMarkUse[];
  readonly fill: IPaint;
  readonly stroke: IPaint;
}

export interface IStyleContext {
  readonly theme: IChartTheme;
}

/** Stands between data and drawing: names the shape to ask for and turns a run into a styled run (§5.2). */
export interface IStyleProcessor<TX = unknown> {
  readonly shape: TShape;
  /** Width of one element along X and the least gap between neighbours, CSS pixels: the scale is chosen from them (§4.3). */
  readonly elementWidth: number;
  readonly elementGap: number;
  style(run: TRun<TX>, context: IStyleContext): IStyle;
}

export interface IStyleDefinition<TX, TWanted extends TShape> {
  readonly shape: TWanted;
  readonly elementWidth: number;
  readonly elementGap: number;
  style(run: TRun<TX, TWanted>, context: IStyleContext): IStyle;
}

/** A style processor for one shape of data: the way to build one's own. It is only ever handed runs of the shape it names. */
export function defineStyle<TX, TWanted extends TShape>(
  definition: IStyleDefinition<TX, TWanted>
): IStyleProcessor<TX> {
  return {
    shape: definition.shape,
    elementWidth: definition.elementWidth,
    elementGap: definition.elementGap,
    style(run, context): IStyle {
      assert(
        isRunOf(run, definition.shape),
        `a style for ${definition.shape} data was given ${run.shape} data`
      );
      return definition.style(run, context);
    },
  };
}

export interface IStyledRun<TX> {
  readonly run: TRun<TX>;
  readonly style: IStyle;
  /** Grows when the series is given another processor. */
  readonly styleRevision: number;
}
