import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { IChartFrame } from '../core/frame/chart-frame';
import { cssOf } from '../core/series/color';
import type { IPaintContribution, ISurface } from '../core/stage/backend';
import { PAINT_BAND } from '../core/stage/backend';
import type { ICanvasPainter, ICanvasPainterContext } from './painter';
import { isCanvasPainterFactory } from './painter';
import { seriesPainter } from './series-painter';

/**
 * A transparent 2D canvas stacked over the others: axes, labels, crosshair,
 * loading bars — and the series, when no other backend draws them. It keeps
 * what it painted and repaints only when a painter's picture went stale or
 * the canvas was cleared.
 */
export class Canvas2dSurface implements ISurface {
  private readonly context: CanvasRenderingContext2D;
  private readonly painters: readonly ICanvasPainter[];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    contributions: readonly IPaintContribution[],
    painterContext: ICanvasPainterContext,
    private readonly drawsSeries: boolean
  ) {
    const context = canvas.getContext('2d');
    assert(!isNil(context), 'the canvas gave no 2D context');
    this.context = context;
    const banded = contributions.map(contribution => {
      assert(
        isCanvasPainterFactory(contribution.painter),
        `"${contribution.id}" carries no 2D canvas painter`
      );
      return { band: contribution.band, painter: contribution.painter(painterContext) };
    });
    if (drawsSeries) {
      banded.push({ band: PAINT_BAND.series, painter: seriesPainter() });
    }
    this.painters = banded
      .sort((first, second) => first.band - second.band)
      .map(each => each.painter);
  }

  paint(frame: IChartFrame<unknown>, now: number): void {
    const { width, height } = frame.size;
    let cleared = false;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      cleared = true;
    }
    // Every painter is asked, not only the first stale one: asking is how each records what it is about to show.
    const stale = this.painters.map(painter => painter.isStale(frame, now));
    if (!cleared && !stale.includes(true)) {
      return;
    }
    this.context.clearRect(0, 0, width, height);
    if (this.drawsSeries) {
      this.context.fillStyle = cssOf(frame.theme.background);
      this.context.fillRect(0, 0, width, height);
    }
    for (const painter of this.painters) {
      painter.paint(this.context, frame, now);
    }
  }

  dispose(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
