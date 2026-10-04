import { isNil } from 'lodash-es';

import type { ChartModel } from '../core/chart-model';
import { nearestElement } from '../core/series/nearest';
import type { ISample } from '../core/series/sample';
import { sampleAt } from '../core/series/sample';
import type { IAxisRange } from '../core/viewport/axis-domain';
import { spanOf } from '../core/viewport/axis-domain';
import { toWorldRange } from '../core/viewport/axis-mapping';

/**
 * Viewport commands an agent issues, written the way the gestures write: zoom eases
 * the target round an anchor as the wheel does, scrolling shifts like a drag, and
 * value scales are held by hand and released as a double tap does. Positions in and
 * out are world coordinates; the cuts of the axis are taken out and put back here.
 */

export interface ISeriesValue<TX> {
  readonly seriesId: string;
  readonly name: string;
  readonly shape: 'point' | 'candle';
  readonly sample: ISample<TX>;
}

function toVirtual<TX>(chart: ChartModel<TX>, world: TX): TX {
  return chart.viewport.x.mapping?.toVirtual(world) ?? world;
}

function toWorld<TX>(chart: ChartModel<TX>, virtual: TX): TX {
  return chart.viewport.x.mapping?.toWorld(virtual) ?? virtual;
}

/** The X range the chart is heading to, in world coordinates. */
export function visibleXRange<TX>(chart: ChartModel<TX>): IAxisRange<TX> {
  const { mapping, target } = chart.viewport.x;
  return isNil(mapping) ? target : toWorldRange(mapping, target);
}

/** The X range the loaded data covers so far, in world coordinates; ends still unknown stay out. */
export function dataXRange<TX>(chart: ChartModel<TX>): Partial<IAxisRange<TX>> {
  const { start, end } = chart.dataExtent;
  return {
    start: isNil(start) ? undefined : toWorld(chart, start),
    end: isNil(end) ? undefined : toWorld(chart, end),
  };
}

/** Scales the X range by `factor` (below 1 zooms in) round `anchor`, the middle by default. */
export function zoomX<TX>(chart: ChartModel<TX>, factor: number, anchor?: TX): void {
  const { domain } = chart;
  const { target } = chart.viewport.x;
  const span = spanOf(domain, target);
  const center = isNil(anchor) ? domain.add(target.start, span / 2) : toVirtual(chart, anchor);
  const share = span === 0 ? 0.5 : domain.diff(center, target.start) / span;
  chart.viewport.x.setTarget({
    start: domain.add(center, -span * factor * share),
    end: domain.add(center, span * factor * (1 - share)),
  });
}

/** Moves the view by `screens` widths of where it is heading: positive to later positions, negative to earlier ones. */
export function scrollX<TX>(chart: ChartModel<TX>, screens: number): void {
  // The target, not the drawn range: right after a zoom the drawn range is still easing.
  chart.viewport.x.shift(spanOf(chart.domain, chart.viewport.x.target) * screens);
}

/** Centres the view on a position, keeping how much it shows. */
export function centerXOn<TX>(chart: ChartModel<TX>, position: TX): void {
  const { domain } = chart;
  const span = spanOf(domain, chart.viewport.x.target);
  const center = toVirtual(chart, position);
  chart.viewport.x.setTarget({
    start: domain.add(center, -span / 2),
    end: domain.add(center, span / 2),
  });
}

export function showXRange<TX>(chart: ChartModel<TX>, range: IAxisRange<TX>): void {
  chart.viewport.x.setTarget({
    start: toVirtual(chart, range.start),
    end: toVirtual(chart, range.end),
  });
}

/** Shows all the data loaded so far; `false` while its extent is still unknown. */
export function fitX<TX>(chart: ChartModel<TX>): boolean {
  const { start, end } = chart.dataExtent;
  if (isNil(start) || isNil(end)) {
    return false;
  }
  chart.viewport.x.setTarget({ start, end });
  return true;
}

/**
 * Stretches a value scale by `factor` round its middle and holds it there, so
 * autoscale leaves it alone; a log scale stretches round its geometric middle.
 */
export function zoomScale<TX>(chart: ChartModel<TX>, scaleId: string, factor: number): void {
  const scale = chart.viewport.scale(scaleId);
  const { start, end } = scale.current;
  if (chart.scales.kindOf(scaleId) === 'log' && start > 0 && end > 0) {
    const center = Math.sqrt(start * end);
    const ratio = (end / start) ** (factor / 2);
    scale.hold({ start: center / ratio, end: center * ratio });
    return;
  }
  const center = (start + end) / 2;
  const half = ((end - start) / 2) * factor;
  scale.hold({ start: center - half, end: center + half });
}

/** Hands the value scales back to autoscale — one, or all when no id is given. */
export function releaseScales<TX>(chart: ChartModel<TX>, scaleId?: string): void {
  const ids = isNil(scaleId) ? chart.viewport.scaleIds : [scaleId];
  ids.forEach(id => chart.viewport.scale(id).release());
}

/** Each series' element nearest to a position, read from the last drawn frame. */
export function valuesAt<TX>(chart: ChartModel<TX>, position: TX): readonly ISeriesValue<TX>[] {
  const { frame } = chart;
  if (isNil(frame)) {
    return [];
  }
  const virtual = toVirtual(chart, position);
  return frame.series.flatMap(series => {
    const nearest = nearestElement(chart.domain, series.runs, virtual);
    if (isNil(nearest)) {
      return [];
    }
    const { run } = nearest.styled;
    const sample = sampleAt(run, nearest.index);
    return [
      {
        seriesId: series.id,
        name: series.name,
        shape: run.shape,
        sample: { ...sample, x: toWorld(chart, sample.x) },
      },
    ];
  });
}
