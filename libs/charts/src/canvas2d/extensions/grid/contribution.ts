import type { IPaintContribution } from '../../../core/stage/backend';
import { ownFrame, PAINT_BAND } from '../../../core/stage/backend';
import type { IGridSlice } from '../../../extensions/grid/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { canvasRectPainter } from '../../rect-painter';

/** The grid as the 2D canvas draws it: for a chart with no other backend under it. */
export function gridOnCanvas<TX>(slice: IGridSlice<TX>): IPaintContribution {
  return {
    id: 'grid',
    backend: CANVAS2D_BACKEND,
    band: PAINT_BAND.grid,
    painter: canvasRectPainter({
      batchOf(frame) {
        const { lines, dashLength, opacity } = slice.gridOf(ownFrame<TX>(frame));
        return { rects: lines, color: frame.theme.grid, opacity, dashLength };
      },
    }),
  };
}
