import { triangulatePolygon } from '@frozik/utils/geometry/triangulatePolygon';
import type { Vector2 } from '@frozik/utils/math/vector2';

/** A colour as the vertex buffer carries it: four bytes, straight alpha. */
export type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

const FLOAT32_BYTES = 4;
const POSITION_FLOATS = 2;
const RGBA_BYTES = 4;
/** `position: float32x2`, `color: unorm8x4`. */
export const MESH_VERTEX_STRIDE_BYTES = POSITION_FLOATS * FLOAT32_BYTES + RGBA_BYTES;
export const MESH_COLOR_OFFSET_BYTES = POSITION_FLOATS * FLOAT32_BYTES;
const INITIAL_CAPACITY_VERTICES = 512;
const GROWTH_FACTOR = 2;
const LITTLE_ENDIAN = true;
const CIRCLE_SEGMENTS = 24;
const FULL_TURN = Math.PI * 2;
/** How far a mitred corner may reach past the ribbon's half width before it is cut short: a fold back on itself would reach forever. */
const MITRE_LIMIT = 4;

export interface MeshData {
  readonly vertexData: ArrayBuffer;
  readonly vertexCount: number;
}

/** Appends flat-coloured triangles into one interleaved vertex buffer, in board metres. */
export class MeshWriter {
  private buffer = new ArrayBuffer(INITIAL_CAPACITY_VERTICES * MESH_VERTEX_STRIDE_BYTES);
  private view = new DataView(this.buffer);
  private count = 0;

  get vertexCount(): number {
    return this.count;
  }

  triangle(a: Vector2, b: Vector2, c: Vector2, color: Rgba): void {
    this.vertex(a, color);
    this.vertex(b, color);
    this.vertex(c, color);
  }

  /** A triangle with a colour per vertex, blended across it — shading without a texture. */
  shadedTriangle(a: Vector2, b: Vector2, c: Vector2, colors: readonly [Rgba, Rgba, Rgba]): void {
    this.vertex(a, colors[0]);
    this.vertex(b, colors[1]);
    this.vertex(c, colors[2]);
  }

  /** Any simple polygon, concave ones included, through earcut. */
  polygon(points: readonly Vector2[], color: Rgba): void {
    const { positions, indices } = triangulatePolygon({ outer: points, holes: [] });
    for (let index = 0; index + 2 < indices.length; index += 3) {
      this.triangle(
        { x: positions[indices[index] * 2], y: positions[indices[index] * 2 + 1] },
        { x: positions[indices[index + 1] * 2], y: positions[indices[index + 1] * 2 + 1] },
        { x: positions[indices[index + 2] * 2], y: positions[indices[index + 2] * 2 + 1] },
        color
      );
    }
  }

  /** A convex polygon as a fan from its first vertex. */
  convexPolygon(points: readonly Vector2[], color: Rgba): void {
    for (let index = 1; index + 1 < points.length; index += 1) {
      this.triangle(points[0], points[index], points[index + 1], color);
    }
  }

  /** A quad `width` wide centred on the segment `from` → `to`. */
  segment(from: Vector2, to: Vector2, width: number, color: Rgba): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const size = Math.hypot(dx, dy);
    if (size === 0) {
      return;
    }
    const nx = (-dy / size) * (width / 2);
    const ny = (dx / size) * (width / 2);
    this.convexPolygon(
      [
        { x: from.x + nx, y: from.y + ny },
        { x: from.x - nx, y: from.y - ny },
        { x: to.x - nx, y: to.y - ny },
        { x: to.x + nx, y: to.y + ny },
      ],
      color
    );
  }

  /**
   * A tapered strip along an open polyline: a width and a colour at every
   * point of it, blended along the way — the wake of the ball, a stream of
   * light. Every bend is mitred, so consecutive quads share their corners
   * exactly: a quad per segment on its own leaves a wedge of background
   * showing on the outside of every bend, which on a translucent ribbon
   * reads as a row of dark notches. A point on top of its neighbour is
   * dropped: it has no direction to be across.
   */
  ribbon(
    points: readonly Vector2[],
    shapeAt: (index: number) => { readonly halfWidth: number; readonly color: Rgba }
  ): void {
    const path = points
      .map((point, index) => ({ point, shape: shapeAt(index) }))
      .filter((node, index, all) => index === 0 || !isSamePoint(all[index - 1].point, node.point));
    if (path.length < 2) {
      return;
    }
    const directions = path
      .slice(0, -1)
      .map((node, index) => direction(node.point, path[index + 1].point));
    const offsets = path.map((node, index) => {
      const into = directions[index - 1] ?? directions[0];
      const outOf = directions[index] ?? directions[directions.length - 1];
      const across = mitreAcross(into, outOf);
      return { x: across.x * node.shape.halfWidth, y: across.y * node.shape.halfWidth };
    });
    for (let index = 0; index + 1 < path.length; index += 1) {
      const [tail, head] = [path[index], path[index + 1]];
      const [near, far] = [offsets[index], offsets[index + 1]];
      const a = { x: tail.point.x + near.x, y: tail.point.y + near.y };
      const b = { x: tail.point.x - near.x, y: tail.point.y - near.y };
      const c = { x: head.point.x - far.x, y: head.point.y - far.y };
      const d = { x: head.point.x + far.x, y: head.point.y + far.y };
      this.shadedTriangle(a, b, c, [tail.shape.color, tail.shape.color, head.shape.color]);
      this.shadedTriangle(a, c, d, [tail.shape.color, head.shape.color, head.shape.color]);
    }
  }

  /**
   * A band `width` wide just inside a closed counter-clockwise outline, one
   * quad per edge meeting its neighbours at mitred corners — a continuous
   * stroke with no gap or overlap at any corner.
   */
  border(points: readonly Vector2[], width: number, color: Rgba): void {
    const count = points.length;
    const normals = points.map((from, index) => {
      const to = points[(index + 1) % count];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const size = Math.hypot(dx, dy);
      return { x: dy / size, y: -dx / size };
    });
    const inner = points.map((point, index) => {
      const before = normals[(index - 1 + count) % count];
      const after = normals[index];
      const miter = 1 + before.x * after.x + before.y * after.y;
      return {
        x: point.x - ((before.x + after.x) * width) / miter,
        y: point.y - ((before.y + after.y) * width) / miter,
      };
    });
    points.forEach((point, index) => {
      const next = (index + 1) % count;
      this.convexPolygon([point, points[next], inner[next], inner[index]], color);
    });
  }

  circle(center: Vector2, radius: number, color: Rgba): void {
    const ring: Vector2[] = [];
    for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
      const angle = (index / CIRCLE_SEGMENTS) * FULL_TURN;
      ring.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    }
    this.convexPolygon(ring, color);
  }

  /** A ring between two radii, for the burst of a destroyed ball. */
  ring(center: Vector2, innerRadius: number, outerRadius: number, color: Rgba): void {
    for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
      const a = (index / CIRCLE_SEGMENTS) * FULL_TURN;
      const b = ((index + 1) / CIRCLE_SEGMENTS) * FULL_TURN;
      const inner1 = {
        x: center.x + Math.cos(a) * innerRadius,
        y: center.y + Math.sin(a) * innerRadius,
      };
      const inner2 = {
        x: center.x + Math.cos(b) * innerRadius,
        y: center.y + Math.sin(b) * innerRadius,
      };
      const outer1 = {
        x: center.x + Math.cos(a) * outerRadius,
        y: center.y + Math.sin(a) * outerRadius,
      };
      const outer2 = {
        x: center.x + Math.cos(b) * outerRadius,
        y: center.y + Math.sin(b) * outerRadius,
      };
      this.triangle(inner1, outer1, outer2, color);
      this.triangle(inner1, outer2, inner2, color);
    }
  }

  finish(): MeshData {
    return {
      vertexData: this.buffer.slice(0, this.count * MESH_VERTEX_STRIDE_BYTES),
      vertexCount: this.count,
    };
  }

  private vertex(point: Vector2, color: Rgba): void {
    this.reserve();
    const offset = this.count * MESH_VERTEX_STRIDE_BYTES;
    this.view.setFloat32(offset, point.x, LITTLE_ENDIAN);
    this.view.setFloat32(offset + FLOAT32_BYTES, point.y, LITTLE_ENDIAN);
    color.forEach((channel, index) => {
      this.view.setUint8(offset + MESH_COLOR_OFFSET_BYTES + index, channel);
    });
    this.count += 1;
  }

  private reserve(): void {
    if ((this.count + 1) * MESH_VERTEX_STRIDE_BYTES <= this.buffer.byteLength) {
      return;
    }
    const grown = new ArrayBuffer(this.buffer.byteLength * GROWTH_FACTOR);
    new Uint8Array(grown).set(new Uint8Array(this.buffer));
    this.buffer = grown;
    this.view = new DataView(grown);
  }
}

function isSamePoint(a: Vector2, b: Vector2): boolean {
  return a.x === b.x && a.y === b.y;
}

function direction(from: Vector2, to: Vector2): Vector2 {
  const size = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: (to.x - from.x) / size, y: (to.y - from.y) / size };
}

/**
 * The way across a ribbon at a point where the way along it bends: the
 * bisector of the two segments' normals, lengthened by the bend so that
 * both quads reach the very same corner. A ribbon that folds back on
 * itself has no bisector — there the incoming normal has to do.
 */
function mitreAcross(into: Vector2, outOf: Vector2): Vector2 {
  const normal = { x: -outOf.y, y: outOf.x };
  const sum = { x: -into.y + normal.x, y: into.x + normal.y };
  const size = Math.hypot(sum.x, sum.y);
  if (size === 0) {
    return normal;
  }
  const unit = { x: sum.x / size, y: sum.y / size };
  const reach = Math.min(1 / (unit.x * normal.x + unit.y * normal.y), MITRE_LIMIT);
  return { x: unit.x * reach, y: unit.y * reach };
}
