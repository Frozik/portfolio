import type { IPaintContribution } from '../../../core/stage/backend';
import { ownFrame, PAINT_BAND } from '../../../core/stage/backend';
import type { ICutsSlice } from '../../../extensions/cuts/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { canvasRectPainter } from '../../rect-painter';

/** The strips at the cuts of the axis as the 2D canvas draws them: for a chart with no other backend under it. */
export function cutsOnCanvas<TX>(slice: ICutsSlice<TX>): IPaintContribution {
  return {
    id: 'cuts',
    backend: CANVAS2D_BACKEND,
    band: PAINT_BAND.grid,
    painter: canvasRectPainter({
      batchOf(frame) {
        const { strips, pattern, opacity } = slice.cutsOf(ownFrame<TX>(frame));
        return { rects: strips, color: frame.theme.cut, opacity, pattern };
      },
    }),
  };
}
