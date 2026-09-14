import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Edge, SurfaceKind } from '../../domain/level';
import type { MeshData } from './mesh-writer';

const FLOAT32_BYTES = 4;
const POSITION_FLOATS = 2;
const LOCAL_FLOATS = 4;
const KIND_BYTES = 4;
/** `position: float32x2`, `local: float32x4` (along, across, length, width — metres), `kind: unorm8x4`. */
export const SURFACE_VERTEX_STRIDE_BYTES =
  (POSITION_FLOATS + LOCAL_FLOATS) * FLOAT32_BYTES + KIND_BYTES;
export const SURFACE_LOCAL_OFFSET_BYTES = POSITION_FLOATS * FLOAT32_BYTES;
export const SURFACE_KIND_OFFSET_BYTES = (POSITION_FLOATS + LOCAL_FLOATS) * FLOAT32_BYTES;
const VERTICES_PER_QUAD = 6;
const LITTLE_ENDIAN = true;
const KIND_BYTE: Readonly<Record<SurfaceKind, number>> = { bounce: 0, sticky: 255 };

interface SurfaceVertex {
  readonly position: Vector2;
  readonly along: number;
  readonly across: number;
}

/**
 * One quad per surface with its own coordinate frame: `along` runs from the
 * face's start, `across` from the face line inwards, negative outside it —
 * the shader paints the membrane or the goo from these, not from the board.
 */
export class SurfaceMeshWriter {
  private readonly quads: {
    readonly vertices: readonly SurfaceVertex[];
    readonly kind: SurfaceKind;
    readonly width: number;
    readonly length: number;
  }[] = [];

  /** The band along `edge`, `width` metres inside the face and `outset` metres beyond it. */
  band(edge: Edge, kind: SurfaceKind, width: number, outset: number): void {
    const corner = (along: number, across: number): SurfaceVertex => ({
      position: {
        x: edge.from.x + edge.direction.x * along - edge.normal.x * across,
        y: edge.from.y + edge.direction.y * along - edge.normal.y * across,
      },
      along,
      across,
    });
    const a = corner(0, -outset);
    const b = corner(edge.length, -outset);
    const c = corner(edge.length, width);
    const d = corner(0, width);
    this.quads.push({ vertices: [a, b, c, a, c, d], kind, width, length: edge.length });
  }

  finish(): MeshData {
    const vertexCount = this.quads.length * VERTICES_PER_QUAD;
    const vertexData = new ArrayBuffer(vertexCount * SURFACE_VERTEX_STRIDE_BYTES);
    const view = new DataView(vertexData);
    let offset = 0;
    for (const quad of this.quads) {
      for (const vertex of quad.vertices) {
        view.setFloat32(offset, vertex.position.x, LITTLE_ENDIAN);
        view.setFloat32(offset + FLOAT32_BYTES, vertex.position.y, LITTLE_ENDIAN);
        const local = offset + SURFACE_LOCAL_OFFSET_BYTES;
        view.setFloat32(local, vertex.along, LITTLE_ENDIAN);
        view.setFloat32(local + FLOAT32_BYTES, vertex.across, LITTLE_ENDIAN);
        view.setFloat32(local + 2 * FLOAT32_BYTES, quad.length, LITTLE_ENDIAN);
        view.setFloat32(local + 3 * FLOAT32_BYTES, quad.width, LITTLE_ENDIAN);
        view.setUint8(offset + SURFACE_KIND_OFFSET_BYTES, KIND_BYTE[quad.kind]);
        offset += SURFACE_VERTEX_STRIDE_BYTES;
      }
    }
    return { vertexData, vertexCount };
  }
}
