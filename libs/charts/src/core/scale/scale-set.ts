import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { IPlotRect } from '../frame/plot-rect';
import type { IChartSize } from '../host/size-source';
import type { IValueRange } from '../viewport/axis-domain';
import type {
  IPaneFrame,
  IPaneOptions,
  IScaleFrame,
  IScaleOptions,
  TScaleKind,
  TScaleSide,
} from './scale';
import { MAIN_PANE, MAIN_SCALE } from './scale';

const DEFAULT_RANGE: IValueRange = { min: 0, max: 1 };
/** Room between two panes, CSS pixels. */
const PANE_GAP = 10;

export interface IScaleSetOptions {
  readonly panes: readonly IPaneOptions[] | undefined;
  readonly scales: readonly IScaleOptions[] | undefined;
  /** The range of the first scale when it names none of its own. */
  readonly range: IValueRange | undefined;
}

interface IScale {
  readonly id: string;
  readonly options: IScaleOptions;
  readonly paneId: string;
  readonly side: TScaleSide;
  readonly order: number;
  range: IValueRange;
}

/**
 * A range with the ends a scale fixes put in place of the fitted ones. When
 * everything fitted lies beyond the one fixed end, the free end keeps the
 * height of the fitted range rather than cross it.
 */
function pinned({ min, max }: IScaleOptions, fitted: IValueRange): IValueRange {
  const span = fitted.max - fitted.min;
  if (!isNil(min)) {
    return { min, max: max ?? (fitted.max > min ? fitted.max : min + span) };
  }
  if (!isNil(max)) {
    return { min: fitted.min < max ? fitted.min : max - span, max };
  }
  return fitted;
}

/**
 * The value scales of a chart and the panes they lie in. A chart that names
 * neither has one pane and one scale on the left. The set owns the range of
 * every scale; where a scale lies on the canvas is worked out for each frame.
 */
export class ScaleSet {
  private readonly panes: readonly IPaneOptions[];
  private readonly scales: readonly IScale[];
  private changes = 0;

  constructor(options: IScaleSetOptions) {
    this.panes = options.panes ?? [{ id: MAIN_PANE }];
    assert(this.panes.length > 0, 'a chart has at least one pane');
    const declared = options.scales ?? [{ id: MAIN_SCALE }];
    assert(declared.length > 0, 'a chart has at least one value scale');
    const firstPane = this.panes[0].id;

    const placed: IScale[] = [];
    for (const [index, scale] of declared.entries()) {
      const paneId = scale.pane ?? firstPane;
      const side = scale.side ?? 'left';
      assert(
        this.panes.some(pane => pane.id === paneId),
        `scale "${scale.id}" names the pane "${paneId}", which the chart does not have`
      );
      assert(
        placed.every(other => other.id !== scale.id),
        `two scales are called "${scale.id}"`
      );
      assert(
        isNil(scale.min) || isNil(scale.max) || scale.min < scale.max,
        `scale "${scale.id}" fixes a minimum that is not below its maximum`
      );
      const initial = (index === 0 ? options.range : undefined) ?? DEFAULT_RANGE;
      placed.push({
        id: scale.id,
        options: scale,
        paneId,
        side,
        order: placed.filter(
          other => other.paneId === paneId && other.side === side && other.options.visible !== false
        ).length,
        range: pinned(scale, initial),
      });
    }
    this.scales = placed;
  }

  /** The scale a series is measured against when it names none. */
  get defaultId(): string {
    return this.scales[0].id;
  }

  get ids(): readonly string[] {
    return this.scales.map(scale => scale.id);
  }

  /** Grows with every change of a range: a frame built for one revision stays valid until the next. */
  get revision(): number {
    return this.changes;
  }

  /** The room the scale asks the autoscale to leave beyond the data; none of its own when it does not say. */
  paddingOf(id: string): number | undefined {
    return this.scaleOf(id).options.padding;
  }

  kindOf(id: string): TScaleKind {
    return this.scaleOf(id).options.kind ?? 'linear';
  }

  rangeOf(id: string): IValueRange {
    return this.scaleOf(id).range;
  }

  /** The ends the scale leaves to the data take the range given; the ends it fixes stay where they are. */
  setRange(id: string, fitted: IValueRange): void {
    const scale = this.scaleOf(id);
    const range = pinned(scale.options, fitted);
    if (scale.range.min !== range.min || scale.range.max !== range.max) {
      scale.range = range;
      this.changes += 1;
    }
  }

  /** How many visible scales stand beyond the first on a side, in the pane that has the most: the gutters the axes need. */
  outerScales(side: TScaleSide): number {
    return Math.max(
      0,
      ...this.scales
        .filter(scale => scale.side === side && scale.options.visible !== false)
        .map(scale => scale.order)
    );
  }

  /** The panes and scales of a frame; `baseOf` gives the value per cent labels of a scale are counted from. */
  layout(
    size: IChartSize,
    plot: IPlotRect,
    baseOf: (scaleId: string) => number | undefined
  ): readonly IPaneFrame[] {
    const totalWeight = this.panes.reduce((sum, pane) => sum + (pane.weight ?? 1), 0);
    const halfGap = (PANE_GAP * size.devicePixelRatio) / 2;
    let weightAbove = 0;

    return this.panes.map((pane, index) => {
      const top = Math.round((size.height * weightAbove) / totalWeight);
      weightAbove += pane.weight ?? 1;
      const bottom = Math.round((size.height * weightAbove) / totalWeight);
      const isFirst = index === 0;
      const isLast = index === this.panes.length - 1;
      const plotTop = isFirst ? plot.top : Math.round(top + halfGap);
      const plotBottom = isLast ? plot.bottom : Math.round(bottom - halfGap);
      const panePlot: IPlotRect = {
        left: plot.left,
        right: plot.right,
        width: plot.width,
        top: plotTop,
        bottom: plotBottom,
        height: Math.max(0, plotBottom - plotTop),
      };
      const scales = this.scales
        .filter(scale => scale.paneId === pane.id)
        .map((scale): IScaleFrame => ({
          id: scale.id,
          paneId: pane.id,
          side: scale.side,
          order: scale.order,
          kind: scale.options.kind ?? 'linear',
          labels: scale.options.labels ?? 'value',
          min: scale.range.min,
          max: scale.range.max,
          inverted: scale.options.inverted ?? false,
          visible: scale.options.visible ?? true,
          title: scale.options.title,
          format: scale.options.format,
          base: scale.options.labels === 'percent' ? baseOf(scale.id) : undefined,
          color: scale.options.color,
          area: { top, height: bottom - top },
          plot: panePlot,
        }));
      return { id: pane.id, plot: panePlot, scales };
    });
  }

  private scaleOf(id: string): IScale {
    const scale = this.scales.find(candidate => candidate.id === id);
    assert(!isNil(scale), `the chart has no value scale "${id}"`);
    return scale;
  }
}
