import { isNil } from 'lodash-es';

import type { IChartFrame, ISeriesFrame } from '../../core/frame/chart-frame';
import { scaleOf } from '../../core/frame/chart-frame';
import type { ICrosshairSlice } from '../../core/frame/crosshair';
import { CROSSHAIR_EXTENSION } from '../../core/frame/crosshair';
import type { IChartExtension } from '../../core/kernel/extension';
import type { TColor } from '../../core/series/color';
import { channelsOf } from '../../core/series/color';
import { nearestElement } from '../../core/series/nearest';
import { isBreakMarker } from '../../core/series/point-run';
import type { ISample } from '../../core/series/sample';
import { sampleAt } from '../../core/series/sample';
import { upperBound } from '../../core/series/search';
import type { IStyledRun } from '../../core/series/style-processor';

/** A legend states the value itself, not a position on an axis: more digits than a tick label has room for. */
const VALUE_FORMAT = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 6,
  useGrouping: false,
});
const GAP_TEXT = '—';

/** What the legend says of one series: its name and the element it reads the values from. */
export interface ILegendEntry<TX> {
  readonly seriesId: string;
  readonly name: string;
  readonly paneId: string;
  /** The colour the element is drawn in: its fill, or its stroke when the fill is transparent. */
  readonly color: TColor;
  readonly x: TX;
  readonly sample: ISample<TX>;
  /** The values written out: one for a point, open, high, low and close for a candle. */
  readonly values: readonly { readonly label: string; readonly text: string }[];
}

export interface ILegendSlice<TX> {
  /** One entry per series that has an element to read; under the pointer when there is one, the last in view otherwise. */
  entriesOf(frame: IChartFrame<TX>): readonly ILegendEntry<TX>[];
  /** Changes whenever the pointer moves: with the frame, all the entries depend on. */
  readonly pointer: unknown;
}

function paintAt(values: number | Uint32Array | Float32Array, index: number): number {
  return typeof values === 'number' ? values : values[index];
}

function colorOf<TX>({ style }: IStyledRun<TX>, index: number): TColor {
  const fill = paintAt(style.fill.color, index);
  return channelsOf(fill).alpha > 0 ? fill : paintAt(style.stroke.color, index);
}

/**
 * The values of every series at the position the crosshair points at — the
 * nearest element of each, not an interpolation — and, while nothing is
 * pointed at, at the last element in view. The headless part: what to say,
 * not how it is drawn.
 */
export function legendCore<TX>(): IChartExtension<TX, 'legend', ILegendSlice<TX>> {
  return {
    id: 'legend',
    create(kernel) {
      const crosshair = (): ICrosshairSlice<TX> | undefined =>
        kernel.extension<ICrosshairSlice<TX>>(CROSSHAIR_EXTENSION);

      /** The last element at or before the right edge of the view, break markers aside. */
      const lastInView = (frame: IChartFrame<TX>, series: ISeriesFrame<TX>) => {
        for (const styled of series.runs.toReversed()) {
          const { run } = styled;
          let index = upperBound(frame.domain, run.x, run.length, frame.x.end) - 1;
          while (index >= 0 && isBreakMarker(run, index)) {
            index -= 1;
          }
          if (index >= 0) {
            return { styled, index };
          }
        }
        return undefined;
      };

      const entryOf = (
        frame: IChartFrame<TX>,
        series: ISeriesFrame<TX>,
        pointedAt: TX | undefined
      ): ILegendEntry<TX> | undefined => {
        const found = isNil(pointedAt)
          ? lastInView(frame, series)
          : nearestElement(frame.domain, series.runs, pointedAt);
        if (isNil(found)) {
          return undefined;
        }
        const { run } = found.styled;
        const scale = scaleOf(frame, series.scaleId);
        const sample = sampleAt(run, found.index);
        const written = (value: number): string =>
          Number.isNaN(value) ? GAP_TEXT : VALUE_FORMAT.format(value);
        return {
          seriesId: series.id,
          name: series.name,
          paneId: scale.paneId,
          color: colorOf(found.styled, found.index),
          x: sample.x,
          sample,
          values:
            run.shape === 'candle'
              ? [
                  { label: 'O', text: written(sample.open) },
                  { label: 'H', text: written(sample.max) },
                  { label: 'L', text: written(sample.min) },
                  { label: 'C', text: written(sample.close) },
                ]
              : [{ label: '', text: written(sample.value) }],
        };
      };

      return {
        slice: {
          entriesOf(frame): readonly ILegendEntry<TX>[] {
            const pointedAt = crosshair()?.crosshairOf(frame)?.x;
            return frame.series.flatMap(series => entryOf(frame, series, pointedAt) ?? []);
          },
          get pointer(): unknown {
            return crosshair()?.position;
          },
        },
      };
    },
  };
}
