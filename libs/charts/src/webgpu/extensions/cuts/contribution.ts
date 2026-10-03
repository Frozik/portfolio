import type { IPaintContribution } from '../../../core/stage/backend';
import { ownFrame, PAINT_BAND } from '../../../core/stage/backend';
import type { ICutsSlice } from '../../../extensions/cuts/core';
import { WEBGPU_BACKEND } from '../../painter';
import { rectPainter } from '../../rect-painter';

/** The strips at the cuts of the axis as WebGPU draws them. */
export function cutsOnWebGpu<TX>(slice: ICutsSlice<TX>): IPaintContribution {
  return {
    id: 'cuts',
    backend: WEBGPU_BACKEND,
    band: PAINT_BAND.grid,
    painter: rectPainter({
      batchOf(frame) {
        const { strips, pattern, opacity } = slice.cutsOf(ownFrame<TX>(frame));
        return { rects: strips, color: frame.theme.cut, opacity, pattern };
      },
    }),
  };
}
