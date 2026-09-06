import { assertNever } from '@frozik/utils/assert/assertNever';
import { isPointOnInfiniteLine, isPointOnSegment } from './geometry-utils';
import type {
  IntersectionEntity,
  SceneTopology,
  TopologyLine,
  TopologyVertex,
  Vec3Array,
} from './topology-types';
import { positionKey, positionsMatch } from './topology-vertices';

/** Which line a crossing belongs to: the ids of the lines a vertex sits inside, and the existing line a new segment is collinear with. */
/**
 * Computes crossLineIds for each vertex using ID-based lookups:
 * - Intersection vertices: use sourceLineIds from IntersectionEntity
 * - Figure/input vertices: check which lines have this vertex as an endpoint (by vertexId),
 *   plus any intersection sourceLineIds that were deduplicated against this vertex's position
 */
export function assignCrossLineIds(
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
export function findCollinearExistingLine(
  topology: SceneTopology,
  startPosition: Vec3Array,
  endPosition: Vec3Array
): TopologyLine | undefined {
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
