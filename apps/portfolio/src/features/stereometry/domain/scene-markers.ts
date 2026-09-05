import { assertNever } from '@frozik/utils/assert/assertNever';

import type { FigureInnerPointCache } from './figure-inner-points';
import { VERTEX_MATCH_EPSILON_SQ } from './geometry-utils';
import { isNearAnyPoint } from './math';
import type { SceneMarker, StyleModifier } from './render-types';
import type { SolutionStatus } from './solution-check';
import type { FigureTopology, SelectionState, TopologyVertex } from './topology-types';

export function buildMarkers(
  figureTopology: FigureTopology,
  sceneVertices: readonly TopologyVertex[],
  selection: SelectionState,
  solutionStatus: SolutionStatus | undefined,
  innerPoints: FigureInnerPointCache
): readonly SceneMarker[] {
  const markers: SceneMarker[] = [];

  for (let markerIndex = 0; markerIndex < sceneVertices.length; markerIndex++) {
    const vertex = sceneVertices[markerIndex];
    const position = vertex.position;
    const modifiers: StyleModifier[] = [];

    if (vertex.kind === 'input') {
      modifiers.push('input');
    }

    const isTopologyVertex = isNearAnyPoint(
      position,
      figureTopology.vertices,
      VERTEX_MATCH_EPSILON_SQ
    );
    if (isTopologyVertex || innerPoints.isInside(figureTopology, position)) {
      modifiers.push('inner');
    }

    if (isVertexOnSelectedElement(vertex, selection)) {
      modifiers.push('selected');
    }

    if (
      solutionStatus?.isSolved &&
      solutionStatus.solutionVertexPositions.some(solutionPosition =>
        isNearAnyPoint(position, [solutionPosition], VERTEX_MATCH_EPSILON_SQ)
      )
    ) {
      modifiers.push('solution');
    }

    markers.push({
      position,
      modifiers,
      vertexIndex: markerIndex,
    });
  }

  return markers;
}

function isVertexOnSelectedElement(vertex: TopologyVertex, selection: SelectionState): boolean {
  switch (selection.type) {
    case 'none':
      return false;
    case 'line': {
      return vertex.crossLineIds.includes(selection.lineId);
    }
    default:
      assertNever(selection);
  }
}
