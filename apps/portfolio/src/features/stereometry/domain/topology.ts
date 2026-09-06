import type { IntersectionCache } from './intersection';
import { computeAllIntersections } from './intersection';
import { assignCrossLineIds, findCollinearExistingLine } from './topology-line-ids';
import type { FigureTopology, SceneTopology, TopologyLine, Vec3Array } from './topology-types';
import { NO_VERTEX_ID } from './topology-types';
import {
  getInputVertexPositions,
  buildBareVertices,
  assignVertexIdsToLines,
} from './topology-vertices';
import type { PuzzleInput } from './types';

/**
 * Creates the initial scene topology from figure topology and optional puzzle input.
 * Input vertices are added as standalone construction points.
 * Input lines are added as topology lines (protected from removal).
 * Intersections between all lines (including input lines vs edges and vs each other)
 * are computed automatically.
 */
export function createTopologyFromPuzzle(
  figureTopology: FigureTopology,
  puzzleInput?: PuzzleInput,
  cache?: IntersectionCache
): SceneTopology {
  const inputVertexPositions: Vec3Array[] =
    puzzleInput?.vertices?.map((position): Vec3Array => [position[0], position[1], position[2]]) ??
    [];

  let lineIdCounter = 0;

  const edgeLines: TopologyLine[] = figureTopology.edges.map(([vertexA, vertexB]) => ({
    lineId: lineIdCounter++,
    pointA: figureTopology.vertices[vertexA],
    pointB: figureTopology.vertices[vertexB],
    kind: 'edge' as const,
    isInput: true,
    startVertexId: NO_VERTEX_ID,
    endVertexId: NO_VERTEX_ID,
  }));

  const inputLines: TopologyLine[] =
    puzzleInput?.lines?.map(([pointA, pointB]) => ({
      lineId: lineIdCounter++,
      pointA: [pointA[0], pointA[1], pointA[2]] as Vec3Array,
      pointB: [pointB[0], pointB[1], pointB[2]] as Vec3Array,
      kind: 'line' as const,
      isInput: true,
      startVertexId: NO_VERTEX_ID,
      endVertexId: NO_VERTEX_ID,
    })) ?? [];

  const inputSegments: TopologyLine[] =
    puzzleInput?.segments?.map(([pointA, pointB]) => ({
      lineId: lineIdCounter++,
      pointA: [pointA[0], pointA[1], pointA[2]] as Vec3Array,
      pointB: [pointB[0], pointB[1], pointB[2]] as Vec3Array,
      kind: 'segment' as const,
      isInput: true,
      startVertexId: NO_VERTEX_ID,
      endVertexId: NO_VERTEX_ID,
    })) ?? [];

  const allLines = [...edgeLines, ...inputLines, ...inputSegments];

  const initialTopology: SceneTopology = {
    figures: [figureTopology],
    lines: allLines,
    vertices: [],
    intersections: [],
    nextLineId: lineIdCounter,
    nextVertexId: 0,
  };

  return finalizeTopology(initialTopology, figureTopology, inputVertexPositions, cache);
}

/**
 * Adds a line between two 3D positions.
 * If the line is collinear with an existing edge/segment, extends it instead.
 * Returns a new immutable SceneTopology.
 */
export function addLine(
  topology: SceneTopology,
  startPosition: Vec3Array,
  endPosition: Vec3Array,
  figureTopology: FigureTopology,
  cache?: IntersectionCache
): SceneTopology {
  // Check if the new line coincides with an existing line through either vertex.
  // - If it's an edge/segment → extend it (edge-extended / segment-extended)
  // - If it's already extended or a line → block (duplicate)
  const collinearLine = findCollinearExistingLine(topology, startPosition, endPosition);
  if (collinearLine !== undefined) {
    if (collinearLine.kind === 'edge' || collinearLine.kind === 'segment') {
      return extendToLine(topology, collinearLine.lineId, figureTopology, cache);
    }
    return topology;
  }

  const newLine: TopologyLine = {
    lineId: topology.nextLineId,
    pointA: startPosition,
    pointB: endPosition,
    kind: 'line',
    isInput: false,
    startVertexId: NO_VERTEX_ID,
    endVertexId: NO_VERTEX_ID,
  };
  return finalizeTopology(
    {
      ...topology,
      lines: [...topology.lines, newLine],
      nextLineId: topology.nextLineId + 1,
    },
    figureTopology,
    getInputVertexPositions(topology),
    cache
  );
}

/**
 * Removes a line by lineId. Input lines cannot be removed.
 * Returns a new immutable SceneTopology.
 */
export function removeLine(
  topology: SceneTopology,
  lineId: number,
  figureTopology: FigureTopology,
  cache?: IntersectionCache
): SceneTopology {
  const line = topology.lines.find(candidate => candidate.lineId === lineId);
  if (line === undefined || line.isInput) {
    return topology;
  }

  return finalizeTopology(
    {
      ...topology,
      lines: topology.lines.filter(candidate => candidate.lineId !== lineId),
    },
    figureTopology,
    getInputVertexPositions(topology),
    cache
  );
}

/**
 * Extends a finite edge/segment into an infinite line by changing its kind.
 * No duplication — the same line changes from 'edge' → 'edge-extended'
 * or 'segment' → 'segment-extended'. lineId is preserved.
 */
export function extendToLine(
  topology: SceneTopology,
  lineId: number,
  figureTopology: FigureTopology,
  cache?: IntersectionCache
): SceneTopology {
  const line = topology.lines.find(candidate => candidate.lineId === lineId);

  if (line === undefined || (line.kind !== 'edge' && line.kind !== 'segment')) {
    return topology;
  }

  const extendedKind = line.kind === 'edge' ? 'edge-extended' : 'segment-extended';

  const updatedLines = topology.lines.map(candidate =>
    candidate.lineId === lineId ? ({ ...candidate, kind: extendedKind } as TopologyLine) : candidate
  );

  return finalizeTopology(
    { ...topology, lines: updatedLines },
    figureTopology,
    getInputVertexPositions(topology),
    cache
  );
}

/**
 * Collapses an extended line back to its original finite form.
 * Changes 'edge-extended' → 'edge' or 'segment-extended' → 'segment'.
 */
export function collapseExtendedLine(
  topology: SceneTopology,
  lineId: number,
  figureTopology: FigureTopology,
  cache?: IntersectionCache
): SceneTopology {
  const line = topology.lines.find(candidate => candidate.lineId === lineId);

  if (line === undefined || (line.kind !== 'edge-extended' && line.kind !== 'segment-extended')) {
    return topology;
  }

  const collapsedKind = line.kind === 'edge-extended' ? 'edge' : 'segment';

  const updatedLines = topology.lines.map(candidate =>
    candidate.lineId === lineId
      ? ({ ...candidate, kind: collapsedKind } as TopologyLine)
      : candidate
  );

  return finalizeTopology(
    { ...topology, lines: updatedLines },
    figureTopology,
    getInputVertexPositions(topology),
    cache
  );
}

/**
 * Recomputes intersections and rebuilds the unified vertex list for a topology
 * after any mutation to lines. Uses incremental cache when available.
 */
function finalizeTopology(
  topology: SceneTopology,
  figureTopology: FigureTopology,
  inputVertexPositions: readonly Vec3Array[],
  cache?: IntersectionCache
): SceneTopology {
  const intersections = cache
    ? cache.compute(topology.lines, figureTopology)
    : computeAllIntersections(topology.lines, figureTopology);

  const { vertices: bareVertices, nextVertexId } = buildBareVertices(
    figureTopology,
    inputVertexPositions,
    intersections,
    topology.nextVertexId
  );

  const lines = assignVertexIdsToLines(topology.lines, bareVertices);

  const vertices = assignCrossLineIds(bareVertices, lines, intersections);

  return {
    ...topology,
    lines,
    intersections,
    vertices,
    nextVertexId,
  };
}
