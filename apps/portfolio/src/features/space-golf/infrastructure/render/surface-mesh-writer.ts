import type { Edge, SurfaceKind } from '../../domain/level';
import type { FramedMeshWriter, FramedVertex, PaintKind } from './framed-mesh-writer';

const KIND_BYTES: Readonly<Record<SurfaceKind, PaintKind>> = {
  bounce: [0, 0, 0, 0],
  sticky: [255, 0, 0, 0],
};

/**
 * One quad per surface in the band's own frame: `along` runs from the
 * face's start, `across` from the face line inwards, negative outside it —
 * the shader paints the membrane or the goo from these, not from the board.
 * The band runs `width` metres inside the face and `outset` metres beyond it.
 */
export function writeSurfaceBand(
  writer: FramedMeshWriter,
  edge: Edge,
  kind: SurfaceKind,
  width: number,
  outset: number
): void {
  const corner = (along: number, across: number): FramedVertex => ({
    position: {
      x: edge.from.x + edge.direction.x * along - edge.normal.x * across,
      y: edge.from.y + edge.direction.y * along - edge.normal.y * across,
    },
    along,
    across,
  });
  writer.quad(
    [
      corner(0, -outset),
      corner(edge.length, -outset),
      corner(edge.length, width),
      corner(0, width),
    ],
    { length: edge.length, width },
    KIND_BYTES[kind]
  );
}
