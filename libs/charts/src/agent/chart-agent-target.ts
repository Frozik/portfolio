import { isNil } from 'lodash-es';

import type { ChartModel } from '../core/chart-model';
import type { IFollowTailSlice } from '../extensions/follow-tail/core';
import {
  centerXOn,
  dataXRange,
  fitX,
  releaseScales,
  scrollX,
  showXRange,
  valuesAt,
  visibleXRange,
  zoomScale,
  zoomX,
} from './chart-commands';
import type { IXCodec } from './x-codec';

const FOLLOW_TAIL_EXTENSION = 'followTail';

export type ChartCommandOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type ChartValuesOutcome =
  | { readonly ok: true; readonly values: readonly IChartSeriesValue[] }
  | { readonly ok: false; readonly reason: string };

const OK: ChartCommandOutcome = { ok: true };

export interface IChartDescription {
  readonly chart: string;
  readonly name: string;
  readonly x: { readonly from: string; readonly to: string };
  readonly data: { readonly from: string | null; readonly to: string | null };
  readonly following: boolean | null;
  readonly scales: readonly {
    readonly id: string;
    readonly kind: string;
    readonly from: number;
    readonly to: number;
    readonly heldByHand: boolean;
  }[];
  readonly series: readonly { readonly id: string; readonly name: string }[];
}

export interface IChartSeriesValue {
  readonly series: string;
  readonly name: string;
  readonly x: string;
  readonly value: number;
  readonly candle?: {
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
  };
}

/**
 * One chart as an agent sees it, whatever its X type: positions travel as text and
 * every command answers whether it was carried out. Built by `defineChartTarget`,
 * which closes over the chart's own coordinate type.
 */
export interface IChartAgentTarget {
  readonly id: string;
  readonly xFormat: string;
  describe(): IChartDescription;
  zoom(factor: number, at?: string): ChartCommandOutcome;
  scroll(screens: number): ChartCommandOutcome;
  goTo(position: string): ChartCommandOutcome;
  showRange(from: string, to: string): ChartCommandOutcome;
  fit(): ChartCommandOutcome;
  zoomScale(scaleId: string, factor: number): ChartCommandOutcome;
  resetScales(scaleId?: string): ChartCommandOutcome;
  followLive(): ChartCommandOutcome;
  valuesAt(position: string): ChartValuesOutcome;
}

export function defineChartTarget<TX>({
  chart,
  codec,
  name,
}: {
  readonly chart: ChartModel<TX>;
  readonly codec: IXCodec<TX>;
  readonly name?: string;
}): IChartAgentTarget {
  const id = chart.id ?? name ?? 'chart';
  const unreadable = (text: string): { readonly ok: false; readonly reason: string } => ({
    ok: false,
    reason: `"${text}" is not a position on this chart; write ${codec.format}.`,
  });
  const withPosition = (text: string, command: (position: TX) => void): ChartCommandOutcome => {
    const position = codec.parse(text);
    if (isNil(position)) {
      return unreadable(text);
    }
    command(position);
    return OK;
  };
  const knowsScale = (scaleId: string): boolean => chart.viewport.scaleIds.includes(scaleId);
  const unknownScale = (scaleId: string): ChartCommandOutcome => ({
    ok: false,
    reason: `This chart has no "${scaleId}" scale; it has ${chart.viewport.scaleIds.join(', ')}.`,
  });

  return {
    id,
    xFormat: codec.format,
    describe() {
      const visible = visibleXRange(chart);
      const data = dataXRange(chart);
      const follow = chart.extension<IFollowTailSlice>(FOLLOW_TAIL_EXTENSION);
      const names = new Map(chart.frame?.series.map(series => [series.id, series.name]));
      return {
        chart: id,
        name: name ?? id,
        x: { from: codec.print(visible.start), to: codec.print(visible.end) },
        data: {
          from: isNil(data.start) ? null : codec.print(data.start),
          to: isNil(data.end) ? null : codec.print(data.end),
        },
        following: isNil(follow) ? null : follow.isFollowing,
        scales: chart.viewport.scaleIds.map(scaleId => {
          const scale = chart.viewport.scale(scaleId);
          return {
            id: scaleId,
            kind: chart.scales.kindOf(scaleId),
            from: scale.target.start,
            to: scale.target.end,
            heldByHand: scale.isHeld,
          };
        }),
        series: chart.series.ids.map(seriesId => ({
          id: seriesId,
          name: names.get(seriesId) ?? seriesId,
        })),
      };
    },
    zoom(factor, at) {
      if (isNil(at)) {
        zoomX(chart, factor);
        return OK;
      }
      return withPosition(at, position => zoomX(chart, factor, position));
    },
    scroll(screens) {
      scrollX(chart, screens);
      return OK;
    },
    goTo: text => withPosition(text, position => centerXOn(chart, position)),
    showRange(from, to) {
      const start = codec.parse(from);
      const end = codec.parse(to);
      if (isNil(start)) {
        return unreadable(from);
      }
      if (isNil(end)) {
        return unreadable(to);
      }
      if (chart.domain.compare(start, end) >= 0) {
        return { ok: false, reason: `"${from}" must come before "${to}".` };
      }
      showXRange(chart, { start, end });
      return OK;
    },
    fit: () =>
      fitX(chart) ? OK : { ok: false, reason: 'The data of this chart has not loaded yet.' },
    zoomScale(scaleId, factor) {
      if (!knowsScale(scaleId)) {
        return unknownScale(scaleId);
      }
      zoomScale(chart, scaleId, factor);
      return OK;
    },
    resetScales(scaleId) {
      if (!isNil(scaleId) && !knowsScale(scaleId)) {
        return unknownScale(scaleId);
      }
      releaseScales(chart, scaleId);
      return OK;
    },
    followLive() {
      const follow = chart.extension<IFollowTailSlice>(FOLLOW_TAIL_EXTENSION);
      if (isNil(follow)) {
        return { ok: false, reason: 'This chart does not follow live data.' };
      }
      follow.resume();
      return OK;
    },
    valuesAt(text) {
      const position = codec.parse(text);
      if (isNil(position)) {
        return unreadable(text);
      }
      const values = valuesAt(chart, position).map(
        ({ seriesId, name: seriesName, shape, sample }) => ({
          series: seriesId,
          name: seriesName,
          x: codec.print(sample.x),
          value: sample.value,
          ...(shape === 'candle'
            ? {
                candle: {
                  open: sample.open,
                  high: sample.max,
                  low: sample.min,
                  close: sample.close,
                },
              }
            : {}),
        })
      );
      return { ok: true, values };
    },
  };
}
