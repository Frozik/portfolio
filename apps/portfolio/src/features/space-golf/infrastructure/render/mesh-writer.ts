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
/**
 * How far a mitred corner may reach past the ribbon's half width before the
 * bend is bevelled instead: a right angle still comes to a point (1.41),
 * anything sharper is cut off. The usual limit for a stroke is 4, which on
 * a wake a few pixels wide reads as a needle rather than a corner.
 */
const MITRE_LIMIT = 1.6;
/** The same for a closed outline's corners, where the mitre is a division: a corner that doubles back reaches four widths and no further. */
const MIN_MITRE_SPREAD = 0.5;

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
   * light. A gentle bend is mitred, so the two quads share their corners
   * exactly and no wedge of background shows through on the outside of it;
   * a sharp one is bevelled instead — each quad keeps its own square end
   * and a triangle fills the wedge between them. Mitring a sharp bend
   * throws its corner out along the way instead of across it, which on the
   * ball's wake read as white needles shooting out of the ball at every
   * bounce. A point on top of its neighbour is dropped: it has no
   * direction to be across.
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
    const joints = path.map((node, index) =>
      jointAcross(
        directions[index - 1] ?? directions[index],
        directions[index] ?? directions[index - 1],
        node.shape.halfWidth
      )
    );
    for (let index = 0; index + 1 < path.length; index += 1) {
      const [tail, head] = [path[index], path[index + 1]];
      const [leaving, arriving] = [joints[index].outOf, joints[index + 1].into];
      const a = { x: tail.point.x + leaving.x, y: tail.point.y + leaving.y };
      const b = { x: tail.point.x - leaving.x, y: tail.point.y - leaving.y };
      const c = { x: head.point.x - arriving.x, y: head.point.y - arriving.y };
      const d = { x: head.point.x + arriving.x, y: head.point.y + arriving.y };
      this.shadedTriangle(a, b, c, [tail.shape.color, tail.shape.color, head.shape.color]);
      this.shadedTriangle(a, c, d, [tail.shape.color, head.shape.color, head.shape.color]);
    }
    path.forEach(({ point, shape }, index) => {
      const { into, outOf, outerSide } = joints[index];
      if (outerSide === 0) {
        return;
      }
      this.triangle(
        point,
        { x: point.x + into.x * outerSide, y: point.y + into.y * outerSide },
        { x: point.x + outOf.x * outerSide, y: point.y + outOf.y * outerSide },
        shape.color
      );
    });
  }

  /**
   * A band `width` wide just inside a closed counter-clockwise outline, one
   * quad per edge meeting its neighbours at mitred corners — a continuous
   * stroke with no gap or overlap at any corner. A corner that doubles back
   * on itself divides by nothing and an outline that repeats a point has no
   * direction there: both are held off, so one bad outline cannot throw a
   * vertex to infinity and draw a line across the screen.
   */
  border(points: readonly Vector2[], width: number, color: Rgba): void {
    const count = points.length;
    const normals = points.map((from, index) => {
      const to = points[(index + 1) % count];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const size = Math.hypot(dx, dy);
      return size === 0 ? { x: 0, y: 0 } : { x: dy / size, y: -dx / size };
    });
    const inner = points.map((point, index) => {
      const before = normals[(index - 1 + count) % count];
      const after = normals[index];
      const miter = Math.max(1 + before.x * after.x + before.y * after.y, MIN_MITRE_SPREAD);
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
 * The two ways across a ribbon at a point where the way along it bends:
 * the one the arriving quad ends on and the one the leaving quad starts
 * from. A gentle bend shares one mitred corner — the bisector of the two
 * normals, lengthened so both quads reach the very same point. A sharp one
 * cannot: the mitre would run off along the way rather than across it, so
 * each quad keeps its own square end and `outerSide` says which side of
 * the bend the wedge between them is left open on, for a triangle to fill.
 */
function jointAcross(
  into: Vector2,
  outOf: Vector2,
  halfWidth: number
): { readonly into: Vector2; readonly outOf: Vector2; readonly outerSide: number } {
  const arriving = { x: -into.y * halfWidth, y: into.x * halfWidth };
  const leaving = { x: -outOf.y * halfWidth, y: outOf.x * halfWidth };
  const bisector = { x: arriving.x + leaving.x, y: arriving.y + leaving.y };
  const size = Math.hypot(bisector.x, bisector.y);
  const reach = size === 0 ? Number.POSITIVE_INFINITY : (2 * halfWidth * halfWidth) / size;
  if (reach <= MITRE_LIMIT * halfWidth) {
    const mitred = { x: (bisector.x / size) * reach, y: (bisector.y / size) * reach };
    return { into: mitred, outOf: mitred, outerSide: 0 };
  }
  // A ribbon folded back on itself ends both quads on the same line: nothing is left open between them.
  const turn = into.x * outOf.y - into.y * outOf.x;
  return { into: arriving, outOf: leaving, outerSide: turn === 0 ? 0 : -Math.sign(turn) };
}
