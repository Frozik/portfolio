import { isNil } from 'lodash-es';

import { floorPixelOf, valueToPixel } from '../../../core/scale/scale-mapping';
import { cssOf } from '../../../core/series/color';
import { areaOptionsOf } from '../../../marks/area/core';
import type { ICanvasMarkPainter } from '../../painter';
import type { IPathPoint } from '../path-points';
import { joined, paintAt, pointsOf } from '../path-points';

/** The area mark on the 2D canvas: a band from the line down to its baseline, broken at gaps (§6.7). */
export const areaCanvasPainter: ICanvasMarkPainter = {
  drawRun(context, frame, { run, style }, use, scale): void {
    const { baseline, join } = areaOptionsOf(use.options);
    const points = joined(pointsOf(frame, run, scale), join);
    const floor = baseline === 'bottom' ? floorPixelOf(scale) : valueToPixel(scale, baseline);
    const isUniform = typeof style.fill.color === 'number';

    let band: IPathPoint[] = [];
    const fillBand = (): void => {
      const [first] = band;
      const last = band.at(-1);
      if (band.length > 1 && !isNil(first) && !isNil(last)) {
        context.fillStyle = cssOf(paintAt(style.fill.color, first.element));
        context.beginPath();
        context.moveTo(first.x, floor);
        for (const point of band) {
          context.lineTo(point.x, point.y);
        }
        context.lineTo(last.x, floor);
        context.closePath();
        context.fill();
      }
      band = [];
    };

    for (const point of points) {
      if (point.isGap) {
        fillBand();
        continue;
      }
      band.push(point);
      // A colour per element: every segment is a band of its own, in the colour of the element it starts at.
      if (!isUniform && band.length === 2) {
        fillBand();
        band.push(point);
      }
    }
    fillBand();
  },
};
