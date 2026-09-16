import type { Vector2 } from '@frozik/utils/math/vector2';

import type { MeshData } from './mesh-writer';

const FLOAT32_BYTES = 4;
const POSITION_FLOATS = 2;
const LOCAL_FLOATS = 4;
const KIND_BYTES = 4;
/** `position: float32x2`, `local: float32x4` (along, across, length, width — metres), `kind: unorm8x4`. */
export const FRAMED_VERTEX_STRIDE_BYTES =
  (POSITION_FLOATS + LOCAL_FLOATS) * FLOAT32_BYTES + KIND_BYTES;
export const FRAMED_LOCAL_OFFSET_BYTES = POSITION_FLOATS * FLOAT32_BYTES;
export const FRAMED_KIND_OFFSET_BYTES = (POSITION_FLOATS + LOCAL_FLOATS) * FLOAT32_BYTES;
const VERTICES_PER_QUAD = 6;
const LITTLE_ENDIAN = true;

/** A corner of a quad: where it is on the board and where it is in the quad's own frame. */
export interface FramedVertex {
  readonly position: Vector2;
  readonly along: number;
  readonly across: number;
}

/** The size of a quad's frame, passed to every vertex so the shader can scale its painting. */
export interface Frame {
  readonly length: number;
  readonly width: number;
}

/**
 * Quads that carry their own coordinate frame to the shader — the painting
 * is done in `along`/`across`, not on the board — plus a kind byte that
 * picks what is painted.
 */
export class FramedMeshWriter {
  private readonly quads: {
    readonly vertices: readonly FramedVertex[];
    readonly frame: Frame;
    readonly kind: number;
  }[] = [];

  /** The corners in order round the quad. */
  quad(
    corners: readonly [FramedVertex, FramedVertex, FramedVertex, FramedVertex],
    frame: Frame,
    kind: number
  ): void {
    const [a, b, c, d] = corners;
    this.quads.push({ vertices: [a, b, c, a, c, d], frame, kind });
  }

  finish(): MeshData {
    const vertexCount = this.quads.length * VERTICES_PER_QUAD;
    const vertexData = new ArrayBuffer(vertexCount * FRAMED_VERTEX_STRIDE_BYTES);
    const view = new DataView(vertexData);
    let offset = 0;
    for (const quad of this.quads) {
      for (const vertex of quad.vertices) {
        view.setFloat32(offset, vertex.position.x, LITTLE_ENDIAN);
        view.setFloat32(offset + FLOAT32_BYTES, vertex.position.y, LITTLE_ENDIAN);
        const local = offset + FRAMED_LOCAL_OFFSET_BYTES;
        view.setFloat32(local, vertex.along, LITTLE_ENDIAN);
        view.setFloat32(local + FLOAT32_BYTES, vertex.across, LITTLE_ENDIAN);
        view.setFloat32(local + 2 * FLOAT32_BYTES, quad.frame.length, LITTLE_ENDIAN);
        view.setFloat32(local + 3 * FLOAT32_BYTES, quad.frame.width, LITTLE_ENDIAN);
        view.setUint8(offset + FRAMED_KIND_OFFSET_BYTES, quad.kind);
        offset += FRAMED_VERTEX_STRIDE_BYTES;
      }
    }
    return { vertexData, vertexCount };
  }
}
