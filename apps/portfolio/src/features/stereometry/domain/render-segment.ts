import type { RenderSegment, StyleModifier } from './render-types';
import type { Vec3Array } from './topology-types';

export function createRenderSegment(
  startPosition: Vec3Array,
  endPosition: Vec3Array,
  modifiers: readonly StyleModifier[],
  lineId: number,
  startVertexIndex: number,
  endVertexIndex: number
): RenderSegment {
  return {
    startPosition,
    endPosition,
    modifiers,
    lineId,
    startVertexIndex,
    endVertexIndex,
  };
}
