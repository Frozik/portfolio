import { vec3 } from 'wgpu-matrix';

import { NO_CONNECTED_VERTEX_INDEX } from './constants';
import { edgeEndpointsMatch } from './geometry-utils';
import { POSITION_EPSILON } from './parametric-utils';
import { createRenderSegment } from './render-segment';
import type { RenderSegment, StyleModifier } from './render-types';
import type { SolutionStatus } from './solution-check';
import { isSubSegmentInSolutionRange } from './solution-check';
import type { FigureTopology, TopologyLine, TopologyVertex, Vec3Array } from './topology-types';

/** Sentinel lineId for topology edge segments rendered by buildTopologyEdgeSegments */
const TOPOLOGY_EDGE_SEGMENT_LINE_ID = -1;

export function buildTopologyEdgeSegments(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selectedEdgeIndices: ReadonlySet<number>,
  solutionStatus: SolutionStatus | undefined
): readonly RenderSegment[] {
  const results: RenderSegment[] = [];

  const edgeLineByIndex = findEdgeLines(figureTopology, lines);

  const vertexIdToMarkerIndex = new Map<number, number>();
  for (let markerIndex = 0; markerIndex < vertices.length; markerIndex++) {
    vertexIdToMarkerIndex.set(vertices[markerIndex].vertexId, markerIndex);
  }

  const pushEdgeSubSegment = (
    startPosition: Vec3Array,
    endPosition: Vec3Array,
    baseModifiers: readonly StyleModifier[],
    startMarkerIndex: number,
    endMarkerIndex: number
  ): void => {
    const modifiers = [...baseModifiers];
    if (
      solutionStatus?.isSolved &&
      solutionStatus.solutionLineRanges.some(([rangeStart, rangeEnd]) =>
        isSubSegmentInSolutionRange(startPosition, endPosition, rangeStart, rangeEnd)
      )
    ) {
      modifiers.push('solution');
    }
    results.push(
      createRenderSegment(
        startPosition,
        endPosition,
        modifiers,
        TOPOLOGY_EDGE_SEGMENT_LINE_ID,
        startMarkerIndex,
        endMarkerIndex
      )
    );
  };

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [figureVertexA, figureVertexB] = figureTopology.edges[edgeIndex];
    const edgeStart = figureTopology.vertices[figureVertexA];
    const edgeEnd = figureTopology.vertices[figureVertexB];

    const edgeLine = edgeLineByIndex.get(edgeIndex);

    // Skip extended edges — the line path in buildSegments renders the original edge portion
    // with an 'edge' modifier promotion. Rendering here would duplicate it.
    if (edgeLine?.kind === 'edge-extended') {
      continue;
    }

    const modifiers: StyleModifier[] = ['edge', 'segment'];
    if (selectedEdgeIndices.has(edgeIndex)) {
      modifiers.push('selected');
    }

    const startMarkerIndex =
      edgeLine !== undefined
        ? (vertexIdToMarkerIndex.get(edgeLine.startVertexId) ?? NO_CONNECTED_VERTEX_INDEX)
        : NO_CONNECTED_VERTEX_INDEX;
    const endMarkerIndex =
      edgeLine !== undefined
        ? (vertexIdToMarkerIndex.get(edgeLine.endVertexId) ?? NO_CONNECTED_VERTEX_INDEX)
        : NO_CONNECTED_VERTEX_INDEX;

    const edgeDir = vec3.sub(edgeEnd, edgeStart);
    const edgeLengthSq = vec3.dot(edgeDir, edgeDir);

    if (edgeLengthSq < POSITION_EPSILON || edgeLine === undefined) {
      pushEdgeSubSegment(edgeStart, edgeEnd, modifiers, startMarkerIndex, endMarkerIndex);
      continue;
    }

    const splitPoints: { parameter: number; markerIndex: number }[] = [];

    for (let markerIndex = 0; markerIndex < vertices.length; markerIndex++) {
      const vertex = vertices[markerIndex];

      if (vertex.vertexId === edgeLine.startVertexId || vertex.vertexId === edgeLine.endVertexId) {
        continue;
      }

      if (!vertex.crossLineIds.includes(edgeLine.lineId)) {
        continue;
      }

      const toVertex = vec3.sub(vertex.position, edgeStart);
      const parameter = vec3.dot(toVertex, edgeDir) / edgeLengthSq;

      if (parameter <= POSITION_EPSILON || parameter >= 1 - POSITION_EPSILON) {
        continue;
      }

      splitPoints.push({ parameter, markerIndex });
    }

    if (splitPoints.length === 0) {
      pushEdgeSubSegment(edgeStart, edgeEnd, modifiers, startMarkerIndex, endMarkerIndex);
      continue;
    }

    splitPoints.sort((pointA, pointB) => pointA.parameter - pointB.parameter);

    let currentPosition = edgeStart;
    let currentMarkerIndex = startMarkerIndex;

    for (const split of splitPoints) {
      const splitPosition = vec3.addScaled(edgeStart, edgeDir, split.parameter) as Vec3Array;

      pushEdgeSubSegment(
        currentPosition,
        splitPosition,
        modifiers,
        currentMarkerIndex,
        split.markerIndex
      );

      currentPosition = splitPosition;
      currentMarkerIndex = split.markerIndex;
    }

    pushEdgeSubSegment(currentPosition, edgeEnd, modifiers, currentMarkerIndex, endMarkerIndex);
  }

  return results;
}

/**
 * Finds the TopologyLine for each figure edge by matching endpoints.
 * Returns a map from edge index to the corresponding TopologyLine.
 */
function findEdgeLines(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[]
): ReadonlyMap<number, TopologyLine> {
  const result = new Map<number, TopologyLine>();
  const edgeLines = lines.filter(line => line.kind === 'edge' || line.kind === 'edge-extended');

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [figureVertexA, figureVertexB] = figureTopology.edges[edgeIndex];
    const edgeStart = figureTopology.vertices[figureVertexA];
    const edgeEnd = figureTopology.vertices[figureVertexB];

    for (const line of edgeLines) {
      if (edgeEndpointsMatch(edgeStart, edgeEnd, line.pointA, line.pointB)) {
        result.set(edgeIndex, line);
        break;
      }
    }
  }

  return result;
}
