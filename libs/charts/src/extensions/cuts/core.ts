import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../core/frame/chart-frame';
import type { IPixelRect } from '../../core/frame/pixel-rect';
import type { TRectPattern } from '../../core/frame/rect-pattern';
import type { IChartExtension } from '../../core/kernel/extension';
import { pixelToX, xToPixel } from '../../core/viewport/plot-mapping';

/** The seam swings this wide, CSS pixels, once every period, drawn by a line this thick. */
const SEAM_WIDTH_PX = 5;
const SEAM_PERIOD_PX = 8;
const SEAM_THICKNESS_PX = 1.5;
const OPACITY = 0.55;
/** Strips closer than this, CSS pixels, would run into one another: the first of them is drawn and the axis is walked on from there. */
const MIN_GAP_PX = 8;

export interface IChartCuts {
  readonly strips: readonly IPixelRect[];
  readonly pattern: TRectPattern;
  readonly opacity: number;
}

export interface ICutsSlice<TX> {
  cutsOf(frame: IChartFrame<TX>): IChartCuts;
}

/**
 * A seam down the plot at every cut of the axis in view — a zigzag line,
 * where the chart skipped over closed time and sewed the two sides together. The axis is walked a gap at a time, asking
 * for the next cut from there, so a view over thousands of sessions costs as
 * many lookups as there are strips to draw. Read from the frame, so a painter
 * asks for nothing the frame has not settled (sessions §6).
 */
export function cutsCore<TX>(): IChartExtension<TX, 'cuts', ICutsSlice<TX>> {
  return {
    id: 'cuts',
    create: () => ({
      slice: {
        cutsOf(frame): IChartCuts {
          const { plot, size, mapping } = frame;
          const { devicePixelRatio } = size;
          const width = Math.round(SEAM_WIDTH_PX * devicePixelRatio);
          const minGap = MIN_GAP_PX * devicePixelRatio;
          const strips: IPixelRect[] = [];
          let from = frame.x.start;
          for (;;) {
            const cut = mapping?.firstCutIn({ start: from, end: frame.x.end });
            if (isNil(cut)) {
              break;
            }
            const pixel = xToPixel(frame, cut.at);
            if (pixel >= plot.left && pixel <= plot.right) {
              strips.push({
                left: Math.round(pixel - width / 2),
                top: plot.top,
                width,
                height: plot.height,
              });
            }
            from = pixelToX(frame, pixel + minGap);
            if (frame.domain.compare(from, cut.at) <= 0) {
              break;
            }
          }
          return {
            strips,
            pattern: {
              kind: 'zigzag',
              period: SEAM_PERIOD_PX * devicePixelRatio,
              thickness: SEAM_THICKNESS_PX * devicePixelRatio,
            },
            opacity: isNil(mapping) ? 0 : OPACITY,
          };
        },
      },
    }),
  };
}
