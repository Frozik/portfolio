import { assertNever } from '@frozik/utils';
import { vec3 } from 'wgpu-matrix';
import { isPointOnInfiniteLine, isPointOnSegment } from './geometry-utils';
import type { IntersectionCache } from './intersection';
import { computeAllIntersections } from './intersection';
import { isNearAnyPoint } from './math';
import type {
  FigureTopology,
  IntersectionEntity,
  SceneTopology,
  TopologyLine,
  TopologyVertex,
  Vec3Array,
} from './topology-types';
import { NO_VERTEX_ID } from './topology-types';
import type { PuzzleInput } from './types';

/** Squared distance threshold for matching positions to topology vertices */
const POSITION_MATCH_THRESHOLD_SQUARED = 0.0001;

/**
 * Squared distance threshold for deduplicating input vertices against
 * topology vertices and computed intersections.
 */
/** Keep tight — must match VERTEX_COINCIDENCE_THRESHOLD_SQUARED in intersection.ts
 * to avoid filtering valid nearby vertices (e.g., intersection near figure vertex). */
const INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED = 1e-5;

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

  // Topology edges become segments with kind='edge'
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
 * Extracts input vertex positions from existing topology vertices.
 */
function getInputVertexPositions(topology: SceneTopology): readonly Vec3Array[] {
  return topology.vertices.filter(vertex => vertex.kind === 'input').map(vertex => vertex.position);
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

  // Phase 1: Build vertices with IDs but without crossLineIds
  const { vertices: bareVertices, nextVertexId } = buildBareVertices(
    figureTopology,
    inputVertexPositions,
    intersections,
    topology.nextVertexId
  );

  // Phase 2: Assign vertex IDs to line endpoints using position matching
  const lines = assignVertexIdsToLines(topology.lines, bareVertices);

  // Phase 3: Compute crossLineIds using ID-based lookups
  const vertices = assignCrossLineIds(bareVertices, lines, intersections);

  return {
    ...topology,
    lines,
    intersections,
    vertices,
    nextVertexId,
  };
}

/**
 * Builds the unified vertex list with IDs but without crossLineIds.
 * Topology vertices first, then input vertices, then intersection points.
 * Input vertices take priority -- intersections that coincide with input
 * vertices are deduplicated away (not the other way around).
 */
function buildBareVertices(
  figureTopology: FigureTopology,
  inputVertexPositions: readonly Vec3Array[],
  intersections: readonly IntersectionEntity[],
  startVertexId: number
): { vertices: readonly TopologyVertex[]; nextVertexId: number } {
  let vertexIdCounter = startVertexId;

  const figureVertices: TopologyVertex[] = figureTopology.vertices.map(position => ({
    vertexId: vertexIdCounter++,
    position,
    kind: 'figure' as const,
    crossLineIds: [],
  }));

  // Input vertices dedup only against topology (they always survive)
  const uniqueInputVertices: TopologyVertex[] = inputVertexPositions
    .filter(
      position =>
        !isNearAnyPoint(position, figureTopology.vertices, INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED)
    )
    .map(position => ({
      vertexId: vertexIdCounter++,
      position,
      kind: 'input' as const,
      crossLineIds: [],
    }));

  // Intersections dedup against both topology vertices and input vertices
  const protectedPositions = [
    ...figureTopology.vertices,
    ...uniqueInputVertices.map(vertex => vertex.position),
  ];

  const uniqueIntersectionVertices: TopologyVertex[] = intersections
    .filter(
      intersection =>
        !isNearAnyPoint(
          intersection.position,
          protectedPositions,
          INPUT_VERTEX_DUPLICATE_THRESHOLD_SQUARED
        )
    )
    .map(intersection => ({
      vertexId: vertexIdCounter++,
      position: intersection.position,
      kind: 'intersection' as const,
      crossLineIds: [],
    }));

  return {
    vertices: [...figureVertices, ...uniqueInputVertices, ...uniqueIntersectionVertices],
    nextVertexId: vertexIdCounter,
  };
}

/**
 * Computes crossLineIds for each vertex using ID-based lookups:
 * - Intersection vertices: use sourceLineIds from IntersectionEntity
 * - Figure/input vertices: check which lines have this vertex as an endpoint (by vertexId),
 *   plus any intersection sourceLineIds that were deduplicated against this vertex's position
 */
function assignCrossLineIds(
  vertices: readonly TopologyVertex[],
  lines: readonly TopologyLine[],
  intersections: readonly IntersectionEntity[]
): readonly TopologyVertex[] {
  // Build a lookup: for each position key, collect all sourceLineIds from intersections
  // that were deduplicated against figure/input vertices at that position
  const intersectionLineIdsByPosition = new Map<string, number[]>();
  for (const intersection of intersections) {
    const key = positionKey(intersection.position);
    const existing = intersectionLineIdsByPosition.get(key);
    if (existing !== undefined) {
      for (const lineId of intersection.sourceLineIds) {
        if (!existing.includes(lineId)) {
          existing.push(lineId);
        }
      }
    } else {
      intersectionLineIdsByPosition.set(key, [...intersection.sourceLineIds]);
    }
  }

  return vertices.map(vertex => {
    let crossLineIds: readonly number[];

    switch (vertex.kind) {
      case 'intersection': {
        // Use sourceLineIds from the matching IntersectionEntity
        const key = positionKey(vertex.position);
        crossLineIds = intersectionLineIdsByPosition.get(key) ?? [];
        break;
      }
      case 'figure':
      case 'input': {
        // Find all lines that this vertex belongs to:
        // 1. Lines where this vertex is an endpoint (by vertexId) — fast ID check
        // 2. Lines where this vertex is an interior point — geometric check needed
        //    (e.g., input vertex placed on a figure edge)
        const lineIds: number[] = [];
        for (const line of lines) {
          if (line.startVertexId === vertex.vertexId || line.endVertexId === vertex.vertexId) {
            lineIds.push(line.lineId);
          } else if (isVertexOnLineInterior(vertex.position, line)) {
            lineIds.push(line.lineId);
          }
        }
        // Also include sourceLineIds from intersections that coincide with this vertex
        // (these were deduplicated away and their line IDs would otherwise be lost)
        const key = positionKey(vertex.position);
        const intersectionLineIds = intersectionLineIdsByPosition.get(key);
        if (intersectionLineIds !== undefined) {
          for (const lineId of intersectionLineIds) {
            if (!lineIds.includes(lineId)) {
              lineIds.push(lineId);
            }
          }
        }
        crossLineIds = lineIds;
        break;
      }
      default:
        assertNever(vertex.kind);
    }

    return { ...vertex, crossLineIds };
  });
}

/**
 * Checks if a position lies on a topology line's interior (not at its endpoints).
 * Uses geometric check — needed for input vertices placed on edges/segments.
 */
function isVertexOnLineInterior(position: Vec3Array, line: TopologyLine): boolean {
  const isFiniteSegment = line.kind === 'edge' || line.kind === 'segment';
  return isFiniteSegment
    ? isPointOnSegment(position, line.pointA, line.pointB)
    : isPointOnInfiniteLine(position, line.pointA, line.pointB);
}

/**
 * Finds an existing topology line that passes through the start vertex and is collinear
 * with the new line direction. Returns the existing line or undefined.
 *
 * Uses ID-based lookup for the vertex (crossLineIds), then geometric collinearity check.
 * This catches: copying a line parallel to an edge into a vertex on that edge.
 */
function findCollinearExistingLine(
  topology: SceneTopology,
  startPosition: Vec3Array,
  endPosition: Vec3Array
): TopologyLine | undefined {
  // Check both endpoints — either vertex may be on an existing line
  for (const position of [startPosition, endPosition]) {
    const vertex = topology.vertices.find(candidate =>
      positionsMatch(candidate.position, position)
    );

    if (vertex === undefined || vertex.crossLineIds.length === 0) {
      continue;
    }

    const otherPosition = position === startPosition ? endPosition : startPosition;

    for (const existingLineId of vertex.crossLineIds) {
      const existingLine = topology.lines.find(line => line.lineId === existingLineId);
      if (existingLine === undefined) {
        continue;
      }

      if (isPointOnInfiniteLine(otherPosition, existingLine.pointA, existingLine.pointB)) {
        return existingLine;
      }
    }
  }

  return undefined;
}

function positionKey(position: Vec3Array): string {
  const PRECISION = 6;
  return `${position[0].toFixed(PRECISION)},${position[1].toFixed(PRECISION)},${position[2].toFixed(PRECISION)}`;
}

/**
 * For each topology line, finds the vertex whose position matches pointA (startVertexId)
 * and the vertex whose position matches pointB (endVertexId).
 */
function assignVertexIdsToLines(
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[]
): readonly TopologyLine[] {
  return lines.map(line => {
    let startVertexId = NO_VERTEX_ID;
    let endVertexId = NO_VERTEX_ID;

    for (const vertex of vertices) {
      if (startVertexId === NO_VERTEX_ID && positionsMatch(vertex.position, line.pointA)) {
        startVertexId = vertex.vertexId;
      }
      if (endVertexId === NO_VERTEX_ID && positionsMatch(vertex.position, line.pointB)) {
        endVertexId = vertex.vertexId;
      }
      if (startVertexId !== NO_VERTEX_ID && endVertexId !== NO_VERTEX_ID) {
        break;
      }
    }

    return { ...line, startVertexId, endVertexId };
  });
}

function positionsMatch(positionA: Vec3Array, positionB: Vec3Array): boolean {
  return vec3.distSq(positionA, positionB) < POSITION_MATCH_THRESHOLD_SQUARED;
}
