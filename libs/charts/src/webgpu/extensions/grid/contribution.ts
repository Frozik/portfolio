import type { IPaintContribution } from '../../../core/stage/backend';
import { ownFrame, PAINT_BAND } from '../../../core/stage/backend';
import type { IGridSlice } from '../../../extensions/grid/core';
import { WEBGPU_BACKEND } from '../../painter';
import { rectPainter } from '../../rect-painter';

/** The grid as WebGPU draws it. */
export function gridOnWebGpu<TX>(slice: IGridSlice<TX>): IPaintContribution {
  return {
    id: 'grid',
    backend: WEBGPU_BACKEND,
    band: PAINT_BAND.grid,
    painter: rectPainter({
      batchOf(frame) {
        const { lines, pattern, opacity } = slice.gridOf(ownFrame<TX>(frame));
        return { rects: lines, color: frame.theme.grid, opacity, pattern };
      },
    }),
  };
}
