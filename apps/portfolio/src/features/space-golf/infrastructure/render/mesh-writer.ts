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
