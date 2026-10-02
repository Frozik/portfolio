import { rgba } from '../../../core/series/color';
import type { IPaintContribution } from '../../../core/stage/backend';
import { ownFrame, PAINT_BAND } from '../../../core/stage/backend';
import type { IDebugBlocksSlice } from '../../../extensions/debug-blocks/core';
import { CANVAS2D_BACKEND } from '../../painter';
import { canvasRectPainter } from '../../rect-painter';

const LINE_COLOR = rgba(1, 1, 0);
const LINE_OPACITY = 0.6;

/** The debug marks as the 2D canvas draws them. */
export function debugBlocksOnCanvas<TX>(slice: IDebugBlocksSlice<TX>): IPaintContribution {
  return {
    id: 'debugBlocks',
    backend: CANVAS2D_BACKEND,
    band: PAINT_BAND.annotation,
    painter: canvasRectPainter({
      revision: () => slice.revision,
      batchOf: frame => ({
        rects: slice.linesOf(ownFrame<TX>(frame)),
        color: LINE_COLOR,
        opacity: LINE_OPACITY,
        dashLength: 0,
      }),
    }),
  };
}
