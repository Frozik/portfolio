import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Edge, Floater, Rod, Segment, SpikeRow, Wall } from './level';

function movePoint(point: Vector2, by: Vector2): Vector2 {
  return { x: point.x + by.x, y: point.y + by.y };
}

function moveSegment<T extends Segment>(segment: T, by: Vector2): T {
  return { ...segment, from: movePoint(segment.from, by), to: movePoint(segment.to, by) };
}

/** The wall moved by `by`: every face keeps its kind, its direction and its normal. */
export function moveWall(wall: Wall, by: Vector2): Wall {
  return {
    vertices: wall.vertices.map(vertex => movePoint(vertex, by)),
    edges: wall.edges.map((edge: Edge) => moveSegment(edge, by)),
    bounds: { min: movePoint(wall.bounds.min, by), max: movePoint(wall.bounds.max, by) },
  };
}

export function moveSpikeRow(row: SpikeRow, by: Vector2): SpikeRow {
  return {
    ...row,
    base: moveSegment(row.base, by),
    sides: row.sides.map(side => moveSegment(side, by)),
  };
}

export function moveFloater(floater: Floater, by: Vector2): Floater {
  return {
    ...floater,
    center: movePoint(floater.center, by),
    small: moveWall(floater.small, by),
    large: moveWall(floater.large, by),
  };
}

export function moveRod(rod: Rod, by: Vector2): Rod {
  return { ...rod, base: movePoint(rod.base, by) };
}
